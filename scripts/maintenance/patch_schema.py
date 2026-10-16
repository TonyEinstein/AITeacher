# -*- coding: utf-8 -*-
import io
path = r'E:\AITeacher\backend\prisma\schema.prisma'
with io.open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old = '  code      String   @unique\n  status    String   @default("active") // active, inactive, trial'
new = '  code      String   @unique\n  province  String?  // 省份，用于跨校排名按省筛选\n  city      String?  // 城市，用于跨校排名按市筛选\n  status    String   @default("active") // active, inactive, trial'

if old in c and 'province' not in c.split('model School')[1].split('model Campus')[0]:
    c = c.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('School 模型已加 province/city 字段')
else:
    print('已存在或未匹配')
