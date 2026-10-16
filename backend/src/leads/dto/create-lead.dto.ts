import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 官网留资表单请求体（POST /leads/public）。
 * 全局 ValidationPipe 已开启 whitelist，未声明字段会被剥离，防止越权字段透传落库。
 */
export class CreateLeadDto {
  @ApiProperty({
    description: '学校/机构名称',
    example: '示例中学',
    maxLength: 120,
  })
  @IsString()
  @Length(1, 120)
  company: string;

  @ApiProperty({ description: '联系人姓名', example: '张老师', maxLength: 40 })
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiProperty({
    description: '联系电话（允许数字、空格、-、+，长度 6~25 且至少含 5 位数字）',
    example: '13800138000',
  })
  @Matches(/^(?=(?:\D*\d){5})[\d\-+ ]{6,25}$/)
  phone: string;

  @ApiPropertyOptional({
    description: '咨询内容（可选）',
    example: '想了解毕业班提分方案',
    maxLength: 500,
  })
  @IsOptional()
  @Length(0, 500)
  message?: string;
}
