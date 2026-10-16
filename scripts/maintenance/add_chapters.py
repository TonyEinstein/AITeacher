# -*- coding: utf-8 -*-
"""给 Textbook 加 chapters 字段"""
import io
path = r'E:\AITeacher\backend\prisma\schema.prisma'
with io.open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old = '  filePath  String   // MinIO 路径\n  status    String   @default("uploaded") // uploaded, parsed, ready'
new = '  filePath  String   // MinIO 路径\n  chapters  String?  // 解析出的章节结构(JSON数组)\n  status    String   @default("uploaded") // uploaded, parsing, parsed, failed'

if 'chapters' not in c.split('model Textbook')[1].split('model LessonPlan')[0]:
    c = c.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Textbook 已加 chapters 字段')
else:
    print('chapters 已存在')
