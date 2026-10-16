import { SetMetadata } from '@nestjs/common';

export enum DataScopeType {
  ALL = 'all',           // Super 管理员：全部数据
  SCHOOL = 'school',     // 校管：本学校
  GRADE = 'grade',       // 年级管理员：本年级
  SUBJECT = 'subject',   // 学科管理员：本学科
  CLASS = 'class',       // 班主任：本班级
  SELF = 'self',         // 学生/家长：仅自己
}

export const DATA_SCOPE_KEY = 'data_scope';
export const DataScope = (scope: DataScopeType) => SetMetadata(DATA_SCOPE_KEY, scope);
