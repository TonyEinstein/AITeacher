# -*- coding: utf-8 -*-
"""修复 face-library.service.ts 和 assignments.service.ts 的编译错误"""
import io

# ===== 修复 face-library.service.ts =====
path1 = r'E:\AITeacher\backend\src\face-library\face-library.service.ts'
with io.open(path1, 'r', encoding='utf-8') as f:
    c1 = f.read()

old_pull = '''  async pullForBox(boxId: number) {
    const box = await this.prisma.box.findUnique({
      where: { id: Number(boxId) },
      include: { room: { include: { classInfo: true } } },
    });
    if (!box) throw new NotFoundException('盒子不存在');
    const classId = box.room?.classInfo?.id;
    if (!classId) throw new BadRequestException('该盒子未绑定班级');

    return this.prisma.facePhoto.findMany({
      where: { student: { classId }, status: { in: ['processed', 'synced'] } },'''

new_pull = '''  async pullForBox(boxId: number) {
    const box = await this.prisma.box.findUnique({ where: { id: Number(boxId) } });
    if (!box) throw new NotFoundException('盒子不存在');
    if (!box.roomId) throw new BadRequestException('该盒子未绑定教室');
    // 通过教室 → 课表 → 班级
    const schedule = await this.prisma.schedule.findFirst({
      where: { roomId: box.roomId, status: { not: 'cancelled' } },
      orderBy: { startTime: 'desc' },
    });
    if (!schedule) throw new BadRequestException('该教室暂无排课，无法确定班级');
    const classId = schedule.classId;

    return this.prisma.facePhoto.findMany({
      where: { student: { classId }, status: { in: ['processed', 'synced'] } },'''

if old_pull in c1:
    c1 = c1.replace(old_pull, new_pull)
    with io.open(path1, 'w', encoding='utf-8') as f:
        f.write(c1)
    print('face-library.service.ts 已修复')
else:
    print('face-library: 未找到匹配，可能已修复')

# ===== 修复 assignments.service.ts =====
path2 = r'E:\AITeacher\backend\src\assignments\assignments.service.ts'
with io.open(path2, 'r', encoding='utf-8') as f:
    c2 = f.read()

old_push = '''    // 通过 lessonPlan → schedules → class 找到关联班级，逐个学生推送
    if (assignment.lessonPlanId) {
      this.prisma.schedule.findMany({
        where: { lessonPlanId: assignment.lessonPlanId },
        include: { classInfo: { include: { students: true } } },
      }).then(schedules => {
        const studentIds = new Set<number>();
        schedules.forEach(s => s.classInfo?.students?.forEach(st => studentIds.add(st.id)));
        studentIds.forEach(sid => {'''

new_push = '''    // 通过 lessonPlan → schedules → classId 找到关联班级，逐个学生推送
    if (assignment.lessonPlanId) {
      this.prisma.schedule.findMany({
        where: { lessonPlanId: assignment.lessonPlanId },
        select: { classId: true },
      }).then(async schedules => {
        const classIds = [...new Set(schedules.map(s => s.classId))];
        const students = await this.prisma.student.findMany({
          where: { classId: { in: classIds } },
          select: { id: true },
        });
        students.forEach(st => {
          const sid = st.id;'''

if old_push in c2:
    c2 = c2.replace(old_push, new_push)
    # 修复后面的闭合（原来有 studentIds.forEach，现在是 students.forEach）
    # 原来的闭合是 }); 后面跟 }).catch
    # 现在需要把 studentIds 相关的闭合改掉
    c2 = c2.replace(
        "        });\n      }).catch(e => this.logger.warn(`作业推送查询失败: ${e?.message}`));",
        "        });\n      }).catch(e => this.logger.warn(`作业推送查询失败: ${e?.message}`));"
    )
    with io.open(path2, 'w', encoding='utf-8') as f:
        f.write(c2)
    print('assignments.service.ts 已修复')
else:
    print('assignments: 未找到匹配，可能已修复')
