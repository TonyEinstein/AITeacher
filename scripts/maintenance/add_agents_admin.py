# -*- coding: utf-8 -*-
"""批量修改管理端：加 agentsApi、路由、菜单"""
import io

# 1. api/index.ts 加 agentsApi（在 avatarApi 后面）
p1 = r'E:\AITeacher\admin-web\src\api\index.ts'
with io.open(p1, 'r', encoding='utf-8') as f:
    c = f.read()
if 'agentsApi' not in c:
    agents_api = '''
export const agentsApi = {
  list: (schoolId?: number) => request.get('/agents', { params: { schoolId } }),
  create: (data: any) => request.post('/agents', data),
  update: (id: number, data: any) => request.put(`/agents/${id}`, data),
  updateStyle: (id: number, style: string) => request.patch(`/agents/${id}/style`, { style }),
  remove: (id: number) => request.delete(`/agents/${id}`),
};
'''
    # 在 avatarApi 块后面插入
    marker = 'export const questionBankApi = {'
    if marker in c:
        c = c.replace(marker, agents_api + '\n' + marker)
    with io.open(p1, 'w', encoding='utf-8') as f:
        f.write(c)
    print('api/index.ts 已加 agentsApi')

# 2. router/index.ts 加路由
p2 = r'E:\AITeacher\admin-web\src\router\index.ts'
with io.open(p2, 'r', encoding='utf-8') as f:
    c = f.read()
if "'agents'" not in c:
    route = "      { path: 'agents', name: 'Agents', component: () => import('../views/agents/index.vue'), meta: { title: 'AI教师管理', icon: 'MagicStick' } },\n"
    # 在 avatars 路由前面插入
    marker = "{ path: 'avatars'"
    if marker in c:
        c = c.replace(marker, route + '      ' + marker)
    with io.open(p2, 'w', encoding='utf-8') as f:
        f.write(c)
    print('router 已加 agents 路由')

# 3. layout/index.vue 加菜单
p3 = r'E:\AITeacher\admin-web\src\layout\index.vue'
with io.open(p3, 'r', encoding='utf-8') as f:
    c = f.read()
if "'/agents'" not in c:
    menu = "  { path: '/agents', title: 'AI教师管理', icon: MagicStick },\n"
    marker = "{ path: '/avatars'"
    if marker in c:
        c = c.replace(marker, menu + '  ' + marker)
    with io.open(p3, 'w', encoding='utf-8') as f:
        f.write(c)
    print('layout 已加 agents 菜单')
