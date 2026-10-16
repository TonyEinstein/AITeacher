# -*- coding: utf-8 -*-
"""在任务规划文档中插入技术债补全阶段（第三批之后、开发规范之前）"""
import io

path = r'E:\AITeacher\docs\product\开发实施方案与任务规划.md'
with io.open(path, 'r', encoding='utf-8') as f:
    content = f.read()

tech_debt_section = '''
## 六-补、技术债补全任务（纯软件，不依赖硬件）

> 以下任务在前三批代码开发中因依赖顺序或外部条件被搁置，现集中补全。
> 全部为纯软件工作，不需要真实硬件即可完成验证。

| 任务编号 | 任务名称 | 任务内容 | 对应原任务 | 进度 | 结果 | 测试实现 | 测试结果 |
|---|---|---|---|---|---|---|---|
| T.01 | Swagger API 文档 | 集成 @nestjs/swagger，/api/docs 可查看全部接口 | 新增 | ⬜ | | 打开/docs能看到接口列表 | |
| T.02 | School表加city/province | School模型加city/province字段，跨校排名按市/省筛选 | 3.3.10 | ⬜ | | 排名可按城市/省份过滤 | |
| T.03 | 人脸库录入接口 | 学生人脸照片上传、人脸特征提取、人脸库下发到盒子 | 新增(关联1.3.11) | ⬜ | | 录入后盒子可识别该学生 | |
| T.04 | 教材 OCR 解析 | 上传PDF/图片后自动提取章节标题与正文，扫描版用OCR | 1.3.02 | ⬜ | | 解析出的章节结构与教材一致 | |
| T.05 | 微信订阅消息推送 | 作业下发/成绩公布时主动推送小程序订阅消息 | 2.1.02 | ⬜ | | 学生能收到作业通知 | |
| T.06 | 教室端 TTS 语音合成 | 按稿讲用本地edge-tts，即兴回答用腾讯云TTS，支持语速/风格 | 1.3.10 | ⬜ | | 数字人开口说话，口型同步 | |
| T.07 | 教室端数字人渲染 | 接入pixi-live2d-display，加载2D模型，张嘴/手势/眨眼动画 | 1.3.09 | ⬜ | | 数字人形象正常显示并动起来 | |
| T.08 | 教室端直播推流+巡课 | 教室端把摄像头画面RTMP推到SRS，管理端巡课页接flv.js播放 | 2.2.05, 2.3.07 | ⬜ | | 家长/老师能看到实时课堂画面 | |
| T.09 | 管理端AI教学风格页 | Agent列表增加风格设置（严肃/温柔/幽默），调用PUT接口 | 3.3.02 | ⬜ | | 切换风格后Agent配置更新 | |

---
'''

# 在 "## 七、开发规范" 之前插入
marker = '## 七、开发规范'
if marker in content:
    content = content.replace(marker, tech_debt_section + marker)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('技术债补全阶段已插入文档')
else:
    print('未找到标记，插入失败')
