import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class TextbooksService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
  ) {}

  async upload(file: any, data: { schoolId: number; subjectId: number; title: string; author?: string; version?: string }) {
    const ext = file.originalname.split('.').pop();
    const fileName = 'textbooks/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const filePath = await this.minio.uploadFile(fileName, file.buffer, file.mimetype);

    return this.prisma.textbook.create({
      data: {
        schoolId: Number(data.schoolId),
        subjectId: Number(data.subjectId),
        title: data.title,
        author: data.author,
        version: data.version,
        filePath,
        status: 'uploaded',
      },
    });
  }

  findBySchool(schoolId: number) {
    return this.prisma.textbook.findMany({
      where: { schoolId },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.textbook.findUnique({
      where: { id },
      include: { subject: true, lessonPlans: true },
    });
  }

  /**
   * 教材 OCR 解析
   * 从 MinIO 下载文件 → 调用 Python 脚本(pdfplumber/PaddleOCR)提取章节 → 存 chapters 字段
   */
  async parse(id: number) {
    const textbook = await this.prisma.textbook.findUnique({ where: { id: Number(id) } });
    if (!textbook) throw new NotFoundException('教材不存在');

    // 标记为解析中
    await this.prisma.textbook.update({ where: { id: Number(id) }, data: { status: 'parsing' } });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ait-ocr-'));
    try {
      // 1. 从 MinIO 下载到临时文件
      const ext = path.extname(textbook.filePath) || '.pdf';
      const tmpInput = path.join(tmpDir, `input${ext}`);
      const tmpOutput = path.join(tmpDir, 'result.json');

      // 从 MinIO 下载（通过 presigned URL 或直接 getObject）
      try {
        const data = await (this.minio as any).client?.getObject?.(
          process.env.MINIO_BUCKET || 'ai-teacher',
          textbook.filePath,
        );
        if (data) {
          const chunks: Buffer[] = [];
          for await (const chunk of data) chunks.push(chunk);
          fs.writeFileSync(tmpInput, Buffer.concat(chunks));
        } else {
          throw new Error('MinIO getObject 返回空');
        }
      } catch (e: any) {
        // MinIO 不可用时，尝试从 filePath 直接读（开发环境可能是本地路径）
        if (fs.existsSync(textbook.filePath)) {
          fs.copyFileSync(textbook.filePath, tmpInput);
        } else {
          throw new BadRequestException(`文件下载失败: ${e?.message || 'MinIO 不可用'}`);
        }
      }

      // 2. 调用 Python OCR 脚本
      const scriptPath = process.env.OCR_SCRIPT_PATH ||
        path.join(process.cwd(), '..', 'classroom-client', 'vision-service', 'ocr', 'parse_textbook.py');
      const pythonCmd = process.env.OCR_PYTHON || 'python';

      if (!fs.existsSync(scriptPath)) {
        throw new BadRequestException(`OCR 脚本不存在: ${scriptPath}`);
      }

      await execFileAsync(pythonCmd, [scriptPath, tmpInput, tmpOutput], {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      // 3. 读取解析结果
      const result = JSON.parse(fs.readFileSync(tmpOutput, 'utf-8'));
      if (result.error) {
        throw new BadRequestException(result.error);
      }

      // 4. 存 chapters 字段
      const chaptersJson = JSON.stringify(result.chapters || []);
      await this.prisma.textbook.update({
        where: { id: Number(id) },
        data: { chapters: chaptersJson, status: 'parsed' },
      });

      return {
        success: true,
        method: result.method,
        totalPages: result.total_pages,
        totalChapters: result.total_chapters,
        chapters: result.chapters?.map((c: any) => ({ title: c.title, page: c.page, level: c.level })),
        note: result.note,
      };
    } catch (e: any) {
      await this.prisma.textbook.update({ where: { id: Number(id) }, data: { status: 'failed' } });
      throw new BadRequestException(`解析失败: ${e?.message || e}`);
    } finally {
      // 无论成功失败都清理临时文件
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略清理失败 */ }
    }
  }

  remove(id: number) {
    return this.prisma.textbook.delete({ where: { id } });
  }
}