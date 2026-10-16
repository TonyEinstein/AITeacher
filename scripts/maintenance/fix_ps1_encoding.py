# -*- coding: utf-8 -*-
"""把 ps1 脚本转为 UTF-8 with BOM（PowerShell 5.1 需要）"""
import io
import os

files = [
    r'E:\AITeacher\infra\docker\start.ps1',
    r'E:\AITeacher\infra\docker\stop.ps1',
    r'E:\AITeacher\infra\docker\status.ps1',
    r'E:\AITeacher\infra\docker\rebuild.ps1',
]

for path in files:
    with io.open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # 写入 UTF-8 with BOM
    with io.open(path, 'w', encoding='utf-8-sig') as f:
        f.write(content)
    print(f'已转换: {os.path.basename(path)}')

print('完成')
