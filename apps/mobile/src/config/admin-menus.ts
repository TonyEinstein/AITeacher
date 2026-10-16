/** 管理端菜单配置（按角色，迁移自 admin-web layout；url 指向 pages-admin 分包页面） */

interface AdminMenuItem {
  url: string
  title: string
}

const P = (name: string) => '/pages-admin/' + name + '/index'

// 公司级菜单（超级管理员默认视图）
const superAdminMenus: AdminMenuItem[] = [
  { url: P('dashboard'), title: '全局概览' },
  { url: P('schools'), title: '学校管理' },
  { url: P('group-overview'), title: '跨校区汇总' },
  { url: P('health'), title: '学校健康' },
  { url: P('device-monitor'), title: '设备监控' },
  { url: P('work-orders'), title: '售后工单' },
  { url: P('subscription'), title: '订阅管理' },
  { url: P('leads'), title: '咨询留资' },
  { url: P('site-config'), title: '官网设置' },
  { url: P('reports/index'), title: '全局报表' },
  { url: P('roi'), title: '成本效益' },
  { url: P('alerts'), title: '预警中心' },
]

// 集团管理员菜单（不含平台级功能）
const groupAdminMenus: AdminMenuItem[] = [
  { url: P('dashboard'), title: '集团概览' },
  { url: P('group-overview'), title: '跨校区汇总' },
  { url: P('health'), title: '学校健康' },
  { url: P('reports/index'), title: '集团报表' },
  { url: P('alerts'), title: '预警中心' },
  { url: P('roi'), title: '成本效益' },
  { url: P('device-monitor'), title: '设备监控' },
  { url: P('subscription'), title: '订阅管理' },
]

// 学校级菜单（学校管理员及以下，或超管进入学校后）
const schoolMenus: AdminMenuItem[] = [
  { url: P('dashboard'), title: '首页概览' },
  { url: P('organization'), title: '组织架构' },
  { url: P('textbooks'), title: '教材教案' },
  { url: P('schedules'), title: '课表管理' },
  { url: P('assignments'), title: '作业复核' },
  { url: P('teacher-workload'), title: '教师工作量' },
  { url: P('reports/exams'), title: '考试管理' },
  { url: P('live'), title: '巡课旁听' },
  { url: P('reports/index'), title: '报表驾驶舱' },
  { url: P('student-report'), title: '学生学情' },
  { url: P('devices'), title: '设备管理' },
  { url: P('tutoring'), title: '辅导管理' },
  { url: P('face-library'), title: '人脸库管理' },
  { url: P('leave-approval'), title: '请假审批' },
  { url: P('question-bank'), title: '学科题库' },
  { url: P('agents'), title: 'AI教师管理' },
  { url: P('avatars'), title: '数字人形象' },
  { url: P('surveys'), title: '满意度问卷' },
  { url: P('alerts'), title: '预警中心' },
  { url: P('roi'), title: '成本效益' },
]

// 年级/学科管理员菜单（教学职能，不含学校级管理）
const teachingMenus: AdminMenuItem[] = [
  { url: P('dashboard'), title: '首页概览' },
  { url: P('textbooks'), title: '教材教案' },
  { url: P('schedules'), title: '课表管理' },
  { url: P('assignments'), title: '作业复核' },
  { url: P('teacher-workload'), title: '教师工作量' },
  { url: P('reports/exams'), title: '考试管理' },
  { url: P('live'), title: '巡课旁听' },
  { url: P('reports/index'), title: '报表驾驶舱' },
  { url: P('student-report'), title: '学生学情' },
  { url: P('question-bank'), title: '学科题库' },
  { url: P('agents'), title: 'AI教师管理' },
  { url: P('avatars'), title: '数字人形象' },
  { url: P('surveys'), title: '满意度问卷' },
]

/** 按角色获取菜单（与 admin-web layout 逻辑一致） */
export function getAdminMenus(role: string, inSchoolView = false): AdminMenuItem[] {
  if (role === 'super_admin' && !inSchoolView) return superAdminMenus
  if (role === 'group_admin') return groupAdminMenus
  if (role === 'grade_admin') return [...teachingMenus, { url: P('alerts'), title: '预警中心' }]
  if (role === 'subject_admin' || role === 'teacher') return teachingMenus
  return schoolMenus
}

export const ROLE_TEXT: Record<string, string> = {
  super_admin: '超级管理员',
  group_admin: '集团管理员',
  school_admin: '学校管理员',
  grade_admin: '年级管理员',
  subject_admin: '学科管理员',
  teacher: '教师',
}
