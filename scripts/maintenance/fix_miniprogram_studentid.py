# -*- coding: utf-8 -*-
"""批量清理小程序 studentId 硬编码"""
import io
import os
import re

base = r'E:\AITeacher\miniprogram\pages'
files = [
    'homework/index.js',
    'homework-detail/index.js',
    'index/index.js',
    'scores/index.js',
    'share/index.js',
    'tutoring/index.js',
    'wrong-book/index.js',
]

for f in files:
    path = os.path.join(base, f)
    if not os.path.exists(path):
        print(f'跳过不存在: {path}')
        continue
    with io.open(path, 'r', encoding='utf-8') as fh:
        content = fh.read()

    original = content

    # 1. 替换 wx.getStorageSync('studentId') || 1 → getStudentId()
    content = content.replace("wx.getStorageSync('studentId') || 1", "getStudentId()")

    # 2. 如果文件中已有 require('../../utils/request')，则添加 getStudentId 到解构
    has_request_require = "require('../../utils/request')" in content
    if has_request_require:
        # 检查是否已经解构了 getStudentId
        if 'getStudentId' not in content.split('\n')[0:5].__str__():
            # 替换 const { request } = require 为 const { request, getStudentId } = require
            content = re.sub(
                r"const\s*\{\s*request\s*\}\s*=\s*require\('\.\./\.\./utils/request'\)",
                "const { request, getStudentId } = require('../../utils/request')",
                content
            )
            # 也处理 uploadFile 的情况
            content = re.sub(
                r"const\s*\{\s*request,\s*uploadFile\s*\}\s*=\s*require\('\.\./\.\./utils/request'\)",
                "const { request, uploadFile, getStudentId } = require('../../utils/request')",
                content
            )
    else:
        # 在文件顶部添加 require
        if 'getStudentId' in content:
            content = "const { getStudentId } = require('../../utils/request');\n" + content

    if content != original:
        with io.open(path, 'w', encoding='utf-8') as fh:
            fh.write(content)
        print(f'已修改: {f}')
    else:
        print(f'无变化: {f}')

print('完成')
