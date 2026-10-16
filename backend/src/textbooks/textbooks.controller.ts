import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, HttpCode, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TextbooksService } from './textbooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const fileUploadOptions = {
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /^(application\/pdf|image\/(jpeg|png)|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('不支持的文件类型'), false);
  },
};

@Controller('textbooks')
@UseGuards(JwtAuthGuard)
export class TextbooksController {
  constructor(private textbooksService: TextbooksService) {}

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', fileUploadOptions))
  upload(
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    return this.textbooksService.upload(file, body);
  }

  @Get()
  findBySchool(@Query('schoolId') schoolId: string) {
    const id = Number(schoolId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('缺少有效的 schoolId 参数');
    }
    return this.textbooksService.findBySchool(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.textbooksService.findOne(Number(id));
  }

  @Post(':id/parse')
  @HttpCode(200)
  parse(@Param('id') id: string) {
    return this.textbooksService.parse(Number(id));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.textbooksService.remove(Number(id));
  }
}