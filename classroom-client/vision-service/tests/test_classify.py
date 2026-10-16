"""
classify_person Behaviors 分类逻辑测试

classify_persons 把一次检测 pass 的人脸/举手/纪律原始输出归一成
「每人一个行为」，供 MinuteAggregator 累加。
"""

import unittest

from behavior.classify import classify_persons


class TestClassifyPersons(unittest.TestCase):
    def test_recognized_face_defaults_to_focus(self):
        """被识别的学生默认专注"""
        faces = [{'studentId': 1, 'box': [100, 100, 80, 80], 'confidence': 0.9}]
        result = classify_persons(faces=faces, hand_raised_ids=set(), sleep_ids=set())
        self.assertEqual(result, [(1, 'focus')])

    def test_hand_raise_overrides_focus(self):
        """举手学生归类为 hand_raise"""
        faces = [{'studentId': 1, 'box': [100, 100, 80, 80], 'confidence': 0.9}]
        result = classify_persons(faces=faces, hand_raised_ids={1}, sleep_ids=set())
        self.assertEqual(result, [(1, 'hand_raise')])

    def test_sleep_overrides_hand_raise(self):
        """睡觉优先级高于举手（趴桌的人不会同时举手）"""
        faces = [{'studentId': 1, 'box': [100, 100, 80, 80], 'confidence': 0.9}]
        result = classify_persons(faces=faces, hand_raised_ids={1}, sleep_ids={1})
        self.assertEqual(result, [(1, 'sleeping')])

    def test_multiple_students_mixed_behaviors(self):
        """多人各自归类互不影响"""
        faces = [
            {'studentId': 1, 'box': [100, 100, 80, 80], 'confidence': 0.9},
            {'studentId': 2, 'box': [300, 100, 80, 80], 'confidence': 0.9},
            {'studentId': 3, 'box': [500, 100, 80, 80], 'confidence': 0.9},
        ]
        result = classify_persons(faces=faces, hand_raised_ids={2}, sleep_ids={3})
        self.assertEqual(
            sorted(result),
            [(1, 'focus'), (2, 'hand_raise'), (3, 'sleeping')],
        )

    def test_unrecognized_face_skipped(self):
        """未识别到 studentId 的人脸跳过（不进聚合，避免脏计数）"""
        faces = [{'box': [100, 100, 80, 80], 'confidence': 0.9}]
        result = classify_persons(faces=faces, hand_raised_ids=set(), sleep_ids=set())
        self.assertEqual(result, [])

    def test_walk_event_counts_as_focus_not_walking(self):
        """walk 事件属于纪律事件流，不改变该分钟的专注归类
        （walking 不在后端 DTO 字段里，靠 totalDetected 体现）"""
        faces = [{'studentId': 1, 'box': [100, 100, 80, 80], 'confidence': 0.9}]
        result = classify_persons(faces=faces, hand_raised_ids=set(), sleep_ids=set(),
                                  walk_ids={1})
        self.assertEqual(result, [(1, 'focus')])


if __name__ == '__main__':
    unittest.main()
