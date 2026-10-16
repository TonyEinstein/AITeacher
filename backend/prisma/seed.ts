import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');
  const pwd = bcrypt.hashSync('123456', 10);

  // 1. Super 管理员
  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { password: pwd },
    create: { username: 'superadmin', password: pwd, name: '超级管理员', role: 'super_admin' },
  });
  console.log('✅ Super 管理员');

  // 2. 创建多所学校
  const schoolsData = [
    { name: 'Sunshine High School', code: 'GZ001', province: '广东省', city: '广州市', status: 'active', contactName: '张校长', contactPhone: '13800138001' },
    { name: 'Maple Grove School', code: 'SZ001', province: '广东省', city: '深圳市', status: 'active', contactName: '李校长', contactPhone: '13800138002' },
    { name: 'Riverside Academy', code: 'FS001', province: '广东省', city: '佛山市', status: 'trial', contactName: '王校长', contactPhone: '13800138003' },
    { name: 'Cedar Hill High School', code: 'DG001', province: '广东省', city: '东莞市', status: 'active', contactName: '赵校长', contactPhone: '13800138004' },
    { name: 'Demo Academy', code: 'TEST001', province: '广东省', city: '广州市', status: 'trial', contactName: '测试校长', contactPhone: '13800000000' },
  ];

  const schools: any[] = [];
  for (const s of schoolsData) {
    const school = await prisma.school.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    schools.push(school);
  }
  console.log(`✅ ${schools.length} 所学校`);

  // 3. 为每所学校创建年级、班级、学生、管理员账号、订阅
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物'];
  for (const subject of subjects) {
    await prisma.subject.upsert({ where: { code: subject }, update: {}, create: { name: subject, code: subject } });
  }

  for (const school of schools) {
    // 校区（PRD §3.32：一个学校 = 一个集团，下辖多个校区）
    const campuses: any[] = [];
    for (const cName of ['本部', '南校区']) {
      let campus = await prisma.campus.findFirst({ where: { schoolId: school.id, name: cName } });
      if (!campus) {
        campus = await prisma.campus.create({
          data: { schoolId: school.id, name: cName, address: `${school.city || '本地'}·${cName}` },
        });
      }
      campuses.push(campus);
    }

    // 年级（分配到校区，跨校区汇总才有数据可算）
    const grades: any[] = [];
    let gradeIdx = 0;
    for (const gName of ['高一', '高二', '高三']) {
      const campusId = campuses[gradeIdx % campuses.length]?.id ?? null;
      let grade = await prisma.grade.findFirst({ where: { schoolId: school.id, name: gName } });
      if (!grade) {
        grade = await prisma.grade.create({ data: { schoolId: school.id, name: gName, campusId } });
      } else if (grade.campusId !== campusId) {
        grade = await prisma.grade.update({ where: { id: grade.id }, data: { campusId } });
      }
      grades.push(grade);
      gradeIdx += 1;
    }

    // 班级 + 学生
    for (const grade of grades) {
      for (let c = 1; c <= 3; c++) {
        let cls = await prisma.class.findFirst({ where: { gradeId: grade.id, name: `${c}班` } });
        if (!cls) cls = await prisma.class.create({ data: { gradeId: grade.id, name: `${c}班` } });
        // 学生
        for (let i = 1; i <= 8; i++) {
          const studentNo = `${school.code}${grade.name}${c}${String(i).padStart(2, '0')}`;
          await prisma.student.upsert({
            where: { studentNo },
            update: {},
            create: { classId: cls.id, name: `${grade.name}${c}班学生${i}`, studentNo },
          });
        }
      }
    }

    // 学校管理员账号
    await prisma.user.upsert({
      where: { username: `${school.code}_admin` },
      update: {},
      create: { username: `${school.code}_admin`, password: pwd, name: `${school.name}管理员`, role: 'school_admin', schoolId: school.id },
    });

    // 集团管理员账号（PRD §3.32：看本集团所有校区，不改教学内容）
    await prisma.user.upsert({
      where: { username: `${school.code}_group` },
      update: { schoolId: school.id },
      create: {
        username: `${school.code}_group`,
        password: pwd,
        name: `${school.name}集团管理员`,
        role: 'group_admin',
        schoolId: school.id,
      },
    });

    // 年级管理员（高一）：绑定本校本年级
    const firstGrade = await prisma.grade.findFirst({ where: { schoolId: school.id }, orderBy: { id: 'asc' } });
    await prisma.user.upsert({
      where: { username: `${school.code}_grade1` },
      update: { gradeId: firstGrade?.id ?? null },
      create: { username: `${school.code}_grade1`, password: pwd, name: `${school.name}高一年级主任`, role: 'grade_admin', schoolId: school.id, gradeId: firstGrade?.id ?? null },
    });

    // 学科管理员（数学）：绑定数学学科
    const mathSubject = await prisma.subject.findFirst({ where: { name: '数学' } });
    await prisma.user.upsert({
      where: { username: `${school.code}_math` },
      update: { subjectId: mathSubject?.id ?? null },
      create: { username: `${school.code}_math`, password: pwd, name: `${school.name}数学教研组长`, role: 'subject_admin', schoolId: school.id, subjectId: mathSubject?.id ?? null },
    });

    // 订阅记录
    const existingSub = await prisma.subscription.findFirst({ where: { schoolId: school.id } });
    if (!existingSub) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      await prisma.subscription.create({
        data: {
          schoolId: school.id,
          plan: school.status === 'trial' ? 'basic' : 'pro',
          startDate, endDate,
          status: school.status === 'active' ? 'active' : 'active',
          amount: school.status === 'active' ? 58000 : 0,
        },
      });
    }

    // 教室设备
    for (let r = 1; r <= 3; r++) {
      const roomCode = `${school.code}-R${r}`;
      let room = await prisma.room.findFirst({ where: { code: roomCode } });
      if (!room) room = await prisma.room.create({ data: { schoolId: school.id, code: roomCode, name: `教室${r}`, capacity: 50 } });
      const boxCode = `${school.code}-BOX${r}`;
      await prisma.box.upsert({
        where: { serialNumber: boxCode },
        update: {},
        create: { serialNumber: boxCode, schoolId: school.id, roomId: room.id, status: r <= 2 ? 'online' : 'offline', type: 'classroom' },
      });
    }

    // 设备故障演示数据（部分盒子进入 error 状态并携带故障编码）
    const faultMap: Record<string, { box: number; code: string; msg: string; hoursAgo: number }[]> = {
      GZ001: [{ box: 3, code: 'E1001', msg: '网络连接中断，教室端无法上报心跳', hoursAgo: 2 }],
      SZ001: [{ box: 3, code: 'E2002', msg: '投影仪信号丢失，HDMI 无输入', hoursAgo: 5 }],
      FS001: [{ box: 1, code: 'E3003', msg: '麦克风阵列离线，语音采集失败', hoursAgo: 1 }],
      DG001: [{ box: 2, code: 'E4004', msg: '温度过高，设备自动降频保护', hoursAgo: 26 }],
    };
    for (const f of faultMap[school.code] || []) {
      const box = await prisma.box.findUnique({ where: { serialNumber: `${school.code}-BOX${f.box}` } });
      if (box && box.status !== 'error') {
        await prisma.box.update({
          where: { id: box.id },
          data: { status: 'error', faultCode: f.code, faultMessage: f.msg, lastErrorAt: new Date(Date.now() - f.hoursAgo * 3600 * 1000) },
        });
      }
    }
  }
  console.log('✅ 年级/班级/学生/管理员账号/订阅/设备/故障');

  // 4. 售后工单测试数据（无工单时写入）
  const woCount = await prisma.workOrder.count();
  if (woCount === 0) {
    const workOrders = [
      { schoolCode: 'GZ001', title: '高一(1)班教室盒子断网', type: 'device_repair', priority: 'high', status: 'processing', description: 'E1001 网络连接中断，教室端无法上报心跳，影响上课。', contactName: '张校长', contactPhone: '13800138001', assignee: '陈工', faultCode: 'E1001' },
      { schoolCode: 'SZ001', title: '高二(3)班投影仪无信号', type: 'device_repair', priority: 'medium', status: 'pending', description: 'E2002 投影仪信号丢失，HDMI 无输入，需现场排查线缆。', contactName: '李校长', contactPhone: '13800138002', faultCode: 'E2002' },
      { schoolCode: 'FS001', title: '试用期套餐咨询', type: 'subscription', priority: 'low', status: 'resolved', description: '佛山二中试用套餐即将到期，学校咨询续费专业版报价。', contactName: '王校长', contactPhone: '13800138003', resolution: '已发送专业版报价单，等待校方确认。', assignee: '商务-刘' },
      { schoolCode: 'DG001', title: '教室盒子高温报警', type: 'device_repair', priority: 'urgent', status: 'pending', description: 'E4004 温度过高，设备自动降频保护，需要尽快处理避免损坏。', contactName: '赵校长', contactPhone: '13800138004', faultCode: 'E4004' },
      { schoolCode: 'GZ001', title: '校园网改造期间专线波动', type: 'network', priority: 'medium', status: 'closed', description: '学校近期网络改造，专线偶发波动导致直播卡顿。', contactName: '张校长', contactPhone: '13800138001', resolution: '已协调运营商在改造窗口期提供备用线路。', assignee: '网络-周' },
      { schoolCode: 'SZ001', title: '数字人形象定制需求', type: 'software', priority: 'low', status: 'pending', description: '希望定制本校校服形象的数字人授课教师。', contactName: '李校长', contactPhone: '13800138002' },
      { schoolCode: 'TEST001', title: 'Demo Academy批量账号开通', type: 'other', priority: 'low', status: 'resolved', description: 'Demo Academy申请开通全校教师演示账号。', contactName: '测试校长', contactPhone: '13800000000', resolution: '已开通，账号见交付文档。', assignee: '实施-郑' },
      { schoolCode: 'DG001', title: '课后辅导功能开通咨询', type: 'subscription', priority: 'medium', status: 'processing', description: '东莞高级中学咨询课后辅导增值服务开通流程与收费。', contactName: '赵校长', contactPhone: '13800138004', assignee: '商务-刘' },
    ];
    for (const wo of workOrders) {
      const school = await prisma.school.findUnique({ where: { code: wo.schoolCode } });
      if (!school) continue;
      const created = await prisma.workOrder.create({
        data: {
          schoolId: school.id,
          title: wo.title,
          type: wo.type,
          priority: wo.priority,
          status: wo.status,
          description: wo.description,
          contactName: wo.contactName,
          contactPhone: wo.contactPhone,
          assignee: wo.assignee || null,
          resolution: wo.resolution || null,
          faultCode: wo.faultCode || null,
          resolvedAt: (wo.status === 'resolved' || wo.status === 'closed') ? new Date() : null,
        },
      });
      if (wo.status === 'resolved' || wo.status === 'closed') {
        await prisma.workOrder.update({ where: { id: created.id }, data: { createdAt: new Date(Date.now() - 3 * 86400 * 1000) } });
      }
    }
    console.log(`✅ ${workOrders.length} 条售后工单`);
  } else {
    console.log(`✅ 售后工单已存在 ${woCount} 条，跳过`);
  }

  // 5. 家长/消息/辅导会话（小程序端情况演示数据）
  for (const school of schools) {
    const students = await prisma.student.findMany({
      where: { class: { grade: { schoolId: school.id } } },
      take: 4,
      include: { class: { include: { grade: true } } },
    });
    let createdParents = 0;
    for (let i = 0; i < students.length; i++) {
      const st = students[i];
      const openId = `${school.code}-parent-${i + 1}`;
      const existing = await prisma.parent.findUnique({ where: { openId } });
      if (!existing) {
        await prisma.parent.create({
          data: {
            studentId: st.id,
            openId,
            name: `${st.name.slice(0, -2)}家长${i + 1}`,
            phone: `137${String(10000000 + school.id * 100 + i).slice(-8)}`,
            relation: i % 2 === 0 ? 'father' : 'mother',
          },
        });
        createdParents++;
      }
    }
    if (createdParents > 0) {
      // 家长消息
      const parents = await prisma.parent.findMany({ where: { student: { class: { grade: { schoolId: school.id } } } }, take: 3 });
      for (const p of parents) {
        await prisma.parentMessage.create({
          data: { parentId: p.id, content: '老师您好，请问今天数学作业的内容是什么？', status: 'pending' },
        });
      }
      // 辅导会话
      const stu = await prisma.student.findFirst({ where: { class: { grade: { schoolId: school.id } } } });
      if (stu) {
        const sessCount = await prisma.tutoringSession.count({ where: { studentId: stu.id } });
        if (sessCount === 0) {
          await prisma.tutoringSession.create({
            data: {
              studentId: stu.id,
              status: 'active',
              startedAt: new Date(Date.now() - 3600 * 1000),
            },
          });
        }
      }
      console.log(`✅ ${school.code} 家长/消息/辅导会话演示数据`);
    }
  }

  // 4. 咨询留资测试数据
  const leadsData = [
    { name: '陈主任', phone: '13900139001', company: '珠海市第三中学', message: '想了解一下产品的具体功能和报价，能否安排演示？' },
    { name: '刘老师', phone: '13700137002', company: '中山市实验中学', message: '我们学校正在寻找智慧教学解决方案，对AI授课很感兴趣。' },
    { name: '黄校长', phone: '13600136003', company: '江门市第一中学', message: '请问支持私有化部署吗？数据安全如何保障？' },
    { name: '吴主任', phone: '13500135004', company: '肇庆市高级中学', message: '课后辅导功能怎么收费？需要什么硬件设备？' },
    { name: '林老师', phone: '13400134005', company: '', message: '个人对产品很感兴趣，想了解更多。' },
    { name: '周校长', phone: '13300133006', company: '汕头市金山中学', message: '我们是省重点中学，希望能深度合作，能否上门洽谈？' },
    { name: '郑主任', phone: '13200132007', company: '湛江市第二中学', message: '目前有多少所学校在使用？效果如何？' },
    { name: '何老师', phone: '13100131008', company: '', message: '从朋友圈分享页看到的，想了解一下。' },
  ];
  for (const l of leadsData) {
    const existing = await prisma.lead.findFirst({ where: { phone: l.phone } });
    if (!existing) await prisma.lead.create({ data: l });
  }
  console.log(`✅ ${leadsData.length} 条咨询留资（按手机号去重）`);

  // 6. 教师演示账号（Sunshine High School）
  const gzSchool = await prisma.school.findUnique({ where: { code: 'GZ001' } });
  if (gzSchool) {
    await prisma.user.upsert({
      where: { username: 'GZ001_teacher' },
      update: {},
      create: {
        username: 'GZ001_teacher',
        password: pwd,
        name: '王老师',
        role: 'teacher',
        schoolId: gzSchool.id,
      },
    });
    console.log('✅ 教师账号 GZ001_teacher (王老师)');
  }

  console.log('🎉 全部初始化数据完成！');
  console.log('');
  console.log('【演示账号】密码均为 123456');
  console.log('  超级管理员:    superadmin（平台视角，看所有学校）');
  console.log('  集团管理员:    GZ001_group（看本集团所有校区，不改教学内容）');
  console.log('  学校管理员:    GZ001_admin (Sunshine High School)');
  console.log('  年级管理员:    GZ001_grade1 (高一年级主任)');
  console.log('  学科管理员:    GZ001_math (数学教研组长)');
  console.log('  教师:          GZ001_teacher (王老师)');
  console.log('  其他学校:      SZ001_admin / FS001_admin / DG001_admin 等（集团管理员同理 _group 后缀）');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
