"""
行为归类：把一次检测 pass 的原始输出归一成「每人一个行为」

输入来自现有检测器的产出：
- faces: FaceRecognizer.recognize() 结果（含 studentId）
- hand_raised_ids: HandRaiseDetector 判定为举手的学生集合
- sleep_ids: DisciplineDetector 判定为趴桌/睡觉的学生集合

优先级：sleeping > hand_raise > focus（趴桌的人不会同时举手）。

说明：talking/using_phone/eating/leaving_seat 依赖 A1 行为分类模型，
模型落地前恒不出现；本函数签名已预留 behaviors 扩展位，落地后无需改动调用方。
"""

import logging

logger = logging.getLogger(__name__)


def classify_persons(
    faces: list,
    hand_raised_ids: set,
    sleep_ids: set,
    walk_ids: set | None = None,
) -> list[tuple[int, str]]:
    """
    :returns: [(studentId, behavior), ...]；behavior ∈ focus/hand_raise/sleeping
              （模型落地后扩展 talking/using_phone/eating/leaving_seat）
    """
    walk_ids = walk_ids or set()
    result = []
    for face in faces:
        sid = face.get('studentId')
        if not sid:
            # 未识别身份的人脸不进聚合（totalDetected 的口径是「已识别学生人次」）
            continue
        if sid in sleep_ids:
            behavior = 'sleeping'
        elif sid in hand_raised_ids:
            behavior = 'hand_raise'
        else:
            behavior = 'focus'
        result.append((sid, behavior))
    return result
