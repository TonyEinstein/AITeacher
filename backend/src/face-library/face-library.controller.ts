import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, HttpCode, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FaceLibraryService } from './face-library.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const fileUploadOptions = {
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req: any, file: any, cb: any) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片文件'), false);
  },
};

@Controller('face-library')
@UseGuards(JwtAuthGuard)
export class FaceLibraryController {
  constructor(private faceLibraryService: FaceLibraryService) {}

  /**
   * 上传学生人脸照片
   */
  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', fileUploadOptions))
  upload(@UploadedFile() file: any, @Body() body: any) {
    return this.faceLibraryService.upload(file, body);
  }

  /**
   * 按学生查询人脸库
   */
  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string) {
    return this.faceLibraryService.findByStudent(Number(studentId));
  }

  /**
   * 按班级查询全班人脸库
   */
  @Get('class/:classId')
  findByClass(@Param('classId') classId: string) {
    return this.faceLibraryService.findByClass(Number(classId));
  }

  /**
   * 按学校查询全校人脸库统计
   */
  @Get('school/:schoolId')
  findBySchool(@Param('schoolId') schoolId: string) {
    return this.faceLibraryService.findBySchool(Number(schoolId));
  }

  /**
   * 下发人脸库到指定盒子
   */
  @Post('sync')
  @HttpCode(200)
  syncToBox(@Body() body: { boxId: number; classId: number }) {
    return this.faceLibraryService.syncToBox(body.boxId, body.classId);
  }

  /**
   * 盒子端拉取人脸库（全量）
   */
  @Get('pull')
  pullForBox(@Query('boxId') boxId: string) {
    const id = Number(boxId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 boxId 参数');
    }
    return this.faceLibraryService.pullForBox(id);
  }

  /**
   * 盒子端回传人脸特征向量
   */
  @Post(':id/feature')
  @HttpCode(200)
  reportFeature(
    @Param('id') id: string,
    @Body() body: { featureVector: number[]; boxId: number },
  ) {
    return this.faceLibraryService.reportFeature(Number(id), body.featureVector, body.boxId);
  }

  /**
   * 删除人脸照片
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faceLibraryService.remove(Number(id));
  }
}
