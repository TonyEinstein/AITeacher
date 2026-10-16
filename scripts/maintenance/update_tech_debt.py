# -*- coding: utf-8 -*-
"""更新技术债补全任务进度为 ✅"""
import io
path = r'E:\AITeacher\docs\product\开发实施方案与任务规划.md'
with io.open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

results = {
    'T.01': 'SwaggerModule集成，/api/docs可访问',
    'T.02': 'School加province/city，db push同步',
    'T.03': 'FacePhoto模型+CRUD+上传+下发+盒子拉取',
    'T.04': 'Python OCR脚本(pdfplumber/PaddleOCR)+后端parse接口',
    'T.05': '微信订阅消息(access_token缓存+作业/成绩推送+模板配置)',
    'T.06': '教室端TTS工具(Web Speech API+风格映射+长文队列)',
    'T.07': 'DigitalAvatar组件(SVG动画+眨眼/张嘴/手势+声波)',
    'T.08': '摄像头采集+MediaRecorder推流+WS发送+管理端flv预留',
    'T.09': '管理端AI教师管理页(风格三选一+创建/删除)',
}

out = []
for line in lines:
    if line.startswith('| T.'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        tid = cells[0]
        if tid in results:
            cells[4] = '✅'
            cells[5] = results[tid]
            cells[7] = '三端编译通过'
            new_line = '| ' + ' | '.join(cells) + ' |\n'
            out.append(new_line)
            continue
    out.append(line)

with io.open(path, 'w', encoding='utf-8') as f:
    f.writelines(out)
print('T.01-T.09 进度已更新为 ✅')
