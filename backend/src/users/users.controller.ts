import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Req, BadRequestException, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @HttpCode(200)
  @Roles('super_admin', 'group_admin', 'school_admin')
  create(@Body() body: CreateUserDto, @Req() req: any) {
    return this.usersService.create(body, req.user);
  }

  @Get()
  @Roles('super_admin', 'group_admin', 'school_admin')
  findAll(@Req() req: any, @Query('schoolId') schoolId?: string) {
    const user = req.user;

    // school_admin 及以下角色：强制只看本校，忽略传入的 schoolId
    if (user.role !== 'super_admin') {
      if (!user.schoolId) return [];
      return this.usersService.findBySchool(Number(user.schoolId));
    }

    // super_admin：传了 schoolId 就按校过滤，不传则返回全部
    if (schoolId !== undefined && schoolId !== '') {
      const id = Number(schoolId);
      if (Number.isNaN(id)) {
        throw new BadRequestException('schoolId 必须是数字');
      }
      return this.usersService.findBySchool(id);
    }
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findOne(Number(id), req.user);
  }

  @Put(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  update(@Param('id') id: string, @Body() body: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(Number(id), body, req.user);
  }

  @Delete(':id')
  @Roles('super_admin', 'group_admin', 'school_admin')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(Number(id), req.user);
  }
}
