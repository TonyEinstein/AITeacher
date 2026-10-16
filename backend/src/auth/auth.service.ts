import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private studentsService: StudentsService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('用户不存在');
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('密码错误');
    const payload = { sub: user.id, username: user.username, role: user.role, schoolId: user.schoolId, gradeId: user.gradeId, subjectId: user.subjectId };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, name: user.name, role: user.role, schoolId: user.schoolId, gradeId: user.gradeId, subjectId: user.subjectId },
    };
  }

  async validateUser(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, schoolId: true, gradeId: true, subjectId: true },
    });
  }

  /** 学生端登录：按学号（+姓名）验证并签发 JWT */
  async studentLogin(studentNo: string, name?: string) {
    const student = await this.studentsService.lookup(studentNo, name);
    const schoolId = student.class?.grade?.schoolId ?? null;
    const payload = {
      sub: student.id,
      username: student.studentNo,
      role: 'student',
      schoolId,
      studentId: student.id,
    };
    return {
      access_token: this.jwtService.sign(payload),
      student: {
        id: student.id,
        studentNo: student.studentNo,
        name: student.name,
        classId: student.classId,
        schoolId,
      },
    };
  }
}