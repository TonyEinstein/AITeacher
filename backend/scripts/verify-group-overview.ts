/**
 * 跨校区汇总 + 集团管理员数据范围验证（PRD §3.32 / §8.7）
 *
 * 覆盖：
 *  - 跨校区汇总：按校区统计学生/班级/年级/平均分/出勤率/已完成课时
 *  - 数据范围：super_admin 看全部；group_admin 只能看本集团
 *  - 越权防护：集团管理员即使伪造 schoolId 也拿不到其他集团数据
 *  - 失败关闭：非平台角色未绑定学校时拒绝而不是放行全量
 *
 * 运行：npx ts-node --transpile-only scripts/verify-group-overview.ts
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CampusesService } from '../src/campuses/campuses.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { DashboardController } from '../src/dashboard/dashboard.controller';

@Module({
  imports: [PrismaModule],
  providers: [CampusesService, DashboardService],
})
class VerifyModule {}

function line(t = '') {
  console.log(t);
}

let failed = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) failed += 1;
}

async function expectThrow(fn: () => Promise<any>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e: any) {
    return e?.message ?? String(e);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const campuses = app.get(CampusesService);
  const dashboard = app.get(DashboardService);
  const controller = new DashboardController(dashboard);

  // ---------- 1. 跨校区汇总 ----------
  const school = await prisma.school.findFirst({
    where: { campuses: { some: {} } },
    include: { campuses: true },
    orderBy: { id: 'asc' },
  });
  if (!school) throw new Error('没有带校区的学校，请先执行 prisma db seed');

  line(`集团「${school.name}」（schoolId=${school.id}），下辖 ${school.campuses.length} 个校区`);

  const overview = await campuses.groupOverview(school.id);
  line(`  校区数=${overview.campusCount} 学生=${overview.summary.totalStudents} 班级=${overview.summary.totalClasses}`);
  for (const c of overview.campuses) {
    line(
      `    - ${c.campusName}: 学生${c.studentCount} 班级${c.classCount} 年级${c.gradeCount} ` +
        `均分${c.avgScore ?? '-'} 出勤率${c.attendanceRate ?? '-'}% 课时${c.completedLessons}`,
    );
  }
  line();

  ok(overview.campusCount >= 2, `该集团应有多个校区，实际 ${overview.campusCount}`);

  const campusSum = overview.campuses.reduce((s, c) => s + c.studentCount, 0);
  ok(
    campusSum === overview.summary.totalStudents,
    `各校区学生数之和应等于总数：${campusSum} vs ${overview.summary.totalStudents}`,
  );

  const realSchoolStudents = await prisma.student.count({
    where: { class: { grade: { schoolId: school.id } } },
  });
  ok(
    overview.summary.totalStudents === realSchoolStudents,
    `汇总学生数应等于该集团实际学生数：${overview.summary.totalStudents} vs ${realSchoolStudents}`,
  );

  const realGrades = await prisma.grade.count({ where: { schoolId: school.id } });
  ok(
    overview.summary.totalGrades === realGrades,
    `汇总年级数应等于该集团实际年级数：${overview.summary.totalGrades} vs ${realGrades}`,
  );

  // 平均分与出勤率要么为 null，要么落在合理区间
  const scoreOk = overview.campuses.every((c) => c.avgScore === null || (c.avgScore >= 0 && c.avgScore <= 100));
  const rateOk = overview.campuses.every((c) => c.attendanceRate === null || (c.attendanceRate >= 0 && c.attendanceRate <= 100));
  ok(scoreOk, '各校区平均分要么为空要么在 0-100 之间');
  ok(rateOk, '各校区出勤率要么为空要么在 0-100 之间');

  // 满意度已实现（2026-10-10 定口径：answers 内 score 字段 1~5 取平均）；
  // 无问卷数据时为 null，属正常态而非缺字段
  ok(
    overview.summary.satisfaction === null || (overview.summary.satisfaction >= 1 && overview.summary.satisfaction <= 5),
    '满意度要么为空（无有效答卷）要么在 1-5 分之间',
  );

  // 数据不应跨集团泄漏
  const otherSchool = await prisma.school.findFirst({ where: { id: { not: school.id } } });
  if (otherSchool) {
    const otherStudents = await prisma.student.count({
      where: { class: { grade: { schoolId: otherSchool.id } } },
    });
    const combined = overview.summary.totalStudents + otherStudents;
    const allStudents = await prisma.student.count();
    ok(
      combined === allStudents || allStudents > combined,
      `本集团 + 其他集团学生数不超过全平台：${combined} <= ${allStudents}`,
    );
  }

  // ---------- 2. 数据范围：super_admin vs group_admin ----------
  line('=== 数据范围与越权防护 ===');
  const all = await controller.globalOverview({ user: { role: 'super_admin' } } as any, undefined);
  const scoped = await controller.globalOverview(
    { user: { role: 'group_admin', schoolId: school.id } } as any,
    undefined,
  );
  line(`  super_admin: 学校数=${all.totalSchools} 学生=${all.totalStudents}`);
  line(`  group_admin: 学校数=${scoped.totalSchools} 学生=${scoped.totalStudents}`);
  line();

  ok(all.totalSchools > 1, `平台视角应能看到多所学校，实际 ${all.totalSchools}`);
  ok(scoped.totalSchools === 1, `集团管理员应只看到本集团 1 所学校，实际 ${scoped.totalSchools}`);
  ok(
    scoped.schoolRanking.length === 1 && scoped.schoolRanking[0].id === school.id,
    '集团管理员看到的学校应是自己所属集团',
  );
  ok(
    scoped.totalStudents === realSchoolStudents,
    `集团管理员看到的学生数应等于本集团学生数：${scoped.totalStudents} vs ${realSchoolStudents}`,
  );

  // 越权：伪造 schoolId
  if (otherSchool) {
    const forged = await controller.globalOverview(
      { user: { role: 'group_admin', schoolId: school.id } } as any,
      String(otherSchool.id),
    );
    ok(
      forged.schoolRanking.length === 1 && forged.schoolRanking[0].id === school.id,
      '集团管理员伪造 schoolId 应被忽略，仍只看到本集团',
    );
  }

  // 失败关闭：非平台角色未绑定学校
  const unbound = await expectThrow(() =>
    controller.globalOverview({ user: { role: 'group_admin' } } as any, undefined),
  );
  ok(/未绑定学校/.test(unbound), `未绑定学校的集团管理员应被拒绝，实际「${unbound}」`);

  // ---------- 3. LLM 用量同样按集团收窄 ----------
  line('=== LLM 用量范围 ===');
  const marker = Date.now();
  await prisma.usageLog.createMany({
    data: [
      { schoolId: school.id, type: 'llm_api', amount: 111, unit: 'tokens' },
      { schoolId: otherSchool?.id ?? school.id, type: 'llm_api', amount: 222, unit: 'tokens' },
    ],
  });
  const scopedUsage = await dashboard.getUsage(1, school.id);
  const allUsage = await dashboard.getUsage(1);
  line(`  本集团 tokens=${scopedUsage.totalTokens}；全平台 tokens=${allUsage.totalTokens}`);
  line();

  ok(scopedUsage.totalTokens === 111, `本集团用量应只统计自己，实际 ${scopedUsage.totalTokens}`);
  if (otherSchool) {
    ok(allUsage.totalTokens >= 333, `全平台用量应包含两所学校，实际 ${allUsage.totalTokens}`);
  }
  ok(
    scopedUsage.bySchool.every((s: any) => s.schoolId === school.id || s.schoolId === null),
    '本集团用量明细不应出现其他学校',
  );

  // 清理本次造的数
  await prisma.usageLog.deleteMany({
    where: { createdAt: { gte: new Date(marker - 60000) }, amount: { in: [111, 222] } },
  });

  // ---------- 4. 集团管理员账号 ----------
  line('=== 集团管理员账号 ===');
  const groupUsers = await prisma.user.findMany({
    where: { role: 'group_admin' },
    select: { username: true, schoolId: true },
  });
  line(`  共 ${groupUsers.length} 个：${groupUsers.map((u) => u.username).join(', ')}`);
  line();

  ok(groupUsers.length > 0, '应存在 group_admin 账号');
  ok(
    groupUsers.every((u) => !!u.schoolId),
    '每个集团管理员都应绑定所属集团（schoolId）',
  );

  line();
  line(failed ? `❌ 存在 ${failed} 项未通过断言` : '✅ 跨校区汇总与集团权限验证通过');
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('验证失败：', e);
  process.exit(1);
});
