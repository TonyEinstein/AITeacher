import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class FaceLibraryService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  /**
   * 上传学生人脸照片
   * 照片存 MinIO，记录入库，状态 pending（待盒子端提取特征）
   */
  async upload(file: any, body: { studentId: number; uploadedBy?: number }) {
    if (!file) throw new BadRequestException('请上传人脸照片');
    if (!body.studentId) throw new BadRequestException('缺少 studentId');

    const student = await this.prisma.student.findUnique({
      where: { id: Number(body.studentId) },
    });
    if (!student) throw new NotFoundException('学生不存在');

    const ext = file.originalname.split('.').pop() || 'jpg';
    const objectName = `faces/student_${body.studentId}_${Date.now()}.${ext}`;
    await this.minio.uploadFile(objectName, file.buffer, file.mimetype);

    const facePhoto = await this.prisma.facePhoto.create({
      data: {
        studentId: Number(body.studentId),
        photoUrl: objectName,
        status: 'pending',
        uploadedBy: body.uploadedBy ? Number(body.uploadedBy) : null,
      },
    });
    return facePhoto;
  }

  /**
   * 按学生查询人脸库
   */
  async findByStudent(studentId: number) {
    return this.prisma.facePhoto.findMany({
      where: { studentId: Number(studentId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 按班级查询全班人脸库（用于下发到盒子）
   */
  async findByClass(classId: number) {
    return this.prisma.facePhoto.findMany({
      where: { student: { classId: Number(classId) } },
      include: { student: { select: { id: true, name: true, studentNo: true } } },
      orderBy: { studentId: 'asc' },
    });
  }

  /**
   * 按学校查询全校人脸库统计
   */
  async findBySchool(schoolId: number) {
    const photos = await this.prisma.facePhoto.findMany({
      where: { student: { class: { grade: { schoolId: Number(schoolId) } } } },
      include: { student: { select: { id: true, name: true, classId: true } } },
    });
    const stats = {
      total: photos.length,
      pending: photos.filter(p => p.status === 'pending').length,
      processed: photos.filter(p => p.status === 'processed').length,
      synced: photos.filter(p => p.status === 'synced').length,
      failed: photos.filter(p => p.status === 'failed').length,
    };
    return { stats, photos };
  }

  /**
   * 删除人脸照片
   */
  async remove(id: number) {
    const photo = await this.prisma.facePhoto.findUnique({ where: { id: Number(id) } });
    if (!photo) throw new NotFoundException('人脸照片不存在');
    await this.minio.deleteFile(photo.photoUrl).catch(() => {});
    await this.prisma.facePhoto.delete({ where: { id: Number(id) } });
    return { success: true };
  }

  /**
   * 盒子端回传人脸特征向量（128维）
   * 盒子提取特征后调用此接口回传，状态改为 processed
   */
  async reportFeature(id: number, featureVector: number[], boxId: number) {
    const photo = await this.prisma.facePhoto.findUnique({ where: { id: Number(id) } });
    if (!photo) throw new NotFoundException('人脸照片不存在');
    return this.prisma.facePhoto.update({
      where: { id: Number(id) },
      data: {
        featureVector: JSON.stringify(featureVector),
        status: 'processed',
        boxId: Number(boxId),
      },
    });
  }

  /**
   * 下发人脸库到指定盒子（批量标记 synced）
   * 盒子通过 GET /face-library/pull?boxId=xxx 拉取全量人脸库
   */
  async syncToBox(boxId: number, classId: number) {
    const photos = await this.prisma.facePhoto.findMany({
      where: { student: { classId: Number(classId) }, status: { in: ['processed', 'pending'] } },
    });
    await this.prisma.facePhoto.updateMany({
      where: { id: { in: photos.map(p => p.id) } },
      data: { status: 'synced', boxId: Number(boxId) },
    });
    return { synced: photos.length, boxId: Number(boxId), classId: Number(classId) };
  }

  /**
   * 盒子端拉取人脸库（全量，含特征向量）
   * 盒子启动或收到 sync 指令后调用
   */
  async pullForBox(boxId: number) {
    const box = await this.prisma.box.findUnique({ where: { id: Number(boxId) } });
    if (!box) throw new NotFoundException('盒子不存在');
    if (!box.roomId) throw new BadRequestException('该盒子未绑定教室');
    // 通过教室 → 课表 → 班级
    const schedule = await this.prisma.schedule.findFirst({
      where: { roomId: box.roomId, status: { not: 'cancelled' } },
      orderBy: { startTime: 'desc' },
    });
    if (!schedule) throw new BadRequestException('该教室暂无排课，无法确定班级');
    const classId = schedule.classId;

    return this.prisma.facePhoto.findMany({
      where: { student: { classId }, status: { in: ['processed', 'synced'] } },
      select: {
        id: true,
        studentId: true,
        photoUrl: true,
        featureVector: true,
        status: true,
        student: { select: { id: true, name: true, studentNo: true } },
      },
    });
  }
}
