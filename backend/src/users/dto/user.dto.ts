import { IsString, IsOptional, IsNumber, IsEnum, MinLength, IsInt } from 'class-validator';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GROUP_ADMIN = 'group_admin',
  SCHOOL_ADMIN = 'school_admin',
  GRADE_ADMIN = 'grade_admin',
  SUBJECT_ADMIN = 'subject_admin',
  TEACHER = 'teacher',
}

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsInt()
  schoolId?: number;

  @IsOptional()
  @IsInt()
  gradeId?: number;

  @IsOptional()
  @IsInt()
  subjectId?: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsInt()
  schoolId?: number;

  @IsOptional()
  @IsInt()
  gradeId?: number;

  @IsOptional()
  @IsInt()
  subjectId?: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
