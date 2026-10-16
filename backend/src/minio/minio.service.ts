import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Client;
  private bucket = process.env.MINIO_BUCKET || 'ai-teacher';

  onModuleInit() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
      port: Number(process.env.MINIO_PORT) || 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    });
    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        console.log('✅ MinIO bucket 创建成功:', this.bucket);
      }
    } catch (e) {
      console.warn('⚠️  MinIO 连接失败，文件上传功能暂不可用');
    }
  }

  async uploadFile(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return fileName;
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.client.removeObject(this.bucket, fileName);
  }
}