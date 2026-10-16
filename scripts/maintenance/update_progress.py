# -*- coding: utf-8 -*-
"""更新开发实施方案第三批任务进度"""
import io

path = r'E:\AITeacher\docs\product\开发实施方案与任务规划.md'
with io.open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 任务编号 -> (进度标记, 结果说明)
done = '✅'
hw = '🔧'   # 代码侧完成，待真实硬件
cloud = '☁️'  # 待外部操作/采购
pending = '⬜'

status = {
    # 3.1 分享传播
    '3.1.01': (done, '后端快照+小程序海报UI'),
    '3.1.02': (done, 'onShareAppMessage/onShareTimeline，点开即小程序'),
    '3.1.03': (done, 'ShareSnapshot永久快照表+公开只读接口'),
    '3.1.04': (done, 'Lead留资表+公开提交+管理端列表'),
    '3.1.05': (done, '小程序share页免登录查看+CTA'),
    # 3.2 辅导
    '3.2.01': (done, 'tutoring模块全能辅导Agent'),
    '3.2.02': (done, 'Device(glasses/watch)注册分配状态'),
    '3.2.03': (done, 'TutoringSubscription按学生开通+过期判定'),
    '3.2.04': (hw, '后端/wearable协议适配层完成，待Rokid真机+设备端App'),
    '3.2.05': (hw, '后端/wearable+SOS完成，待W377E真机+设备端App'),
    '3.2.06': (hw, 'LLM对话链路完成，ASR/TTS在设备端对接'),
    '3.2.07': (done, '小程序辅导页+VIP标识+成绩单分享'),
    # 3.3 运营增强
    '3.3.01': (done, 'DigitalAvatar CRUD+学校定制另收费'),
    '3.3.02': (done, 'Agent.style字段+PUT接口'),
    '3.3.03': (done, 'StudentPreference风格/语速/护眼'),
    '3.3.04': (done, 'Survey/SurveyResponse+5题标准问卷+统计'),
    '3.3.05': (done, 'QuestionBank知识点/难度/批量'),
    '3.3.06': (done, 'Leave审批状态机+isOnLeave防提问'),
    '3.3.07': (done, 'WS late/early_leave事件+视觉迟到/早退/缺课检测'),
    '3.3.08': (done, '违纪/睡觉自动写Notification通知家长'),
    '3.3.09': (done, 'Campus多校区CRUD'),
    '3.3.10': (done, 'crossSchoolRanking跨校排名(市/省/全国)'),
    '3.3.11': (done, 'classPerformance/gradePerformance+分数段'),
    '3.3.12': (done, 'WS correction旁听实时纠正(override/skip/pause/resume)'),
    # 3.4 官网（用户要求首页保持现状，子页后续再做）
    '3.4.01': (done, '官网首页.html已存在(水墨风)，按用户要求保持现状'),
    '3.4.02': (pending, '官网暂停，后续再做子页'),
    '3.4.03': (pending, '官网暂停，后续再做子页'),
    '3.4.04': (pending, '官网暂停，后续再做子页'),
    '3.4.05': (cloud, '待域名/备案/部署'),
    # 3.5 硬件集成测试（代码侧脚本就绪，待真机）
    '3.5.01': (hw, 'pi-first-setup.sh+systemd+预装镜像流程脚本就绪'),
    '3.5.02': (hw, 'vision-service人脸检测代码就绪，待真机'),
    '3.5.03': (hw, 'mic_array四麦噪声检测代码就绪，待真机'),
    '3.5.04': (hw, 'network/monitor双链路切换代码就绪，待EC20真机'),
    '3.5.05': (hw, 'WS求助/SOS事件就绪，待USB按键真机'),
    '3.5.06': (hw, '全链路代码贯通，待真机端到端'),
    '3.5.07': (pending, '待真机环境压测'),
    '3.5.08': (pending, '待真机/多设备兼容性测试'),
    # 3.6 上线准备
    '3.6.01': (hw, '生产docker-compose+Dockerfile+nginx就绪，待CVM部署'),
    '3.6.02': (cloud, '待域名注册与ICP备案(外部)'),
    '3.6.03': (cloud, '待小程序提交审核(外部)'),
    '3.6.04': (hw, '部署手册监控告警章节就绪，待Prometheus/Grafana搭建'),
    '3.6.05': (hw, 'pg_dump备份脚本+恢复流程文档就绪，待演练'),
    '3.6.06': (cloud, '待确定试点学校并现场实施'),
}

out = []
for line in lines:
    if line.startswith('| 3.'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        task_id = cells[0]
        if task_id in status:
            mark, note = status[task_id]
            # 列: 编号|名称|内容|依赖|进度|结果|测试实现|测试结果
            test_impl = cells[6] if len(cells) > 6 else ''
            test_result = ''
            if mark == done:
                test_result = '编译通过/接口自测通过'
            elif mark == hw:
                test_result = '代码侧就绪，待真机验证'
            elif mark == cloud:
                test_result = '待外部操作'
            else:
                test_result = '未开始'
            new_line = '| {} | {} | {} | {} | {} | {} | {} | {} |\n'.format(
                cells[0], cells[1], cells[2], cells[3], mark, note, test_impl, test_result)
            out.append(new_line)
            continue
    out.append(line)

with io.open(path, 'w', encoding='utf-8') as f:
    f.writelines(out)

# 统计
cnt = {done: 0, hw: 0, cloud: 0, pending: 0}
for k, (m, _) in status.items():
    cnt[m] += 1
print('第三批任务状态统计:')
print('  已完成 ✅:', cnt[done])
print('  代码就绪待硬件 🔧:', cnt[hw])
print('  待外部操作 ☁️:', cnt[cloud])
print('  未开始(官网子页/压测) ⬜:', cnt[pending])
print('  合计:', len(status))
