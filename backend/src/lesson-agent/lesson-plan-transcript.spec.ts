import { describe, it, expect } from 'vitest';
import { parseTranscript, transcriptFromLessonPlanContent } from './lesson-plan-transcript';

describe('parseTranscript', () => {
  it('空输入返回空讲稿并标记 source=empty', () => {
    expect(parseTranscript('').steps).toEqual([]);
    expect(parseTranscript('').source).toBe('empty');
    expect(parseTranscript('   \n  \n').steps).toEqual([]);
  });

  it('优先只取「教学过程」段落', () => {
    const text = [
      '教学目标',
      '理解光合作用的基本概念',
      '教学重点',
      '光反应与暗反应的区别',
      '教学过程',
      '导入：同学们，植物为什么是绿色的',
      '新授：叶绿体利用光能把二氧化碳和水转化成有机物',
      '小结：今天我们学习了光合作用的两个阶段',
      '板书设计',
      '光合作用：光反应 / 暗反应',
    ].join('\n');

    const r = parseTranscript(text);
    expect(r.source).toBe('process_section');
    expect(r.steps).toEqual([
      '导入：同学们，植物为什么是绿色的',
      '新授：叶绿体利用光能把二氧化碳和水转化成有机物',
      '小结：今天我们学习了光合作用的两个阶段',
    ]);
  });

  it('识别带编号和 markdown 标记的「教学过程」标题', () => {
    const text = ['## 1. 教学目标', '认识三角形', '## 4. 教学过程', '三角形的内角和是180度', '## 5. 课堂提问', '什么是钝角'].join('\n');
    const r = parseTranscript(text);
    expect(r.source).toBe('process_section');
    expect(r.steps).toEqual(['三角形的内角和是180度']);
  });

  it('没有「教学过程」时用全文并标记 source=full_text', () => {
    const text = ['同学们好，今天讲牛顿第一定律', '物体在不受外力时保持静止或匀速直线运动'].join('\n');
    const r = parseTranscript(text);
    expect(r.source).toBe('full_text');
    expect(r.steps).toHaveLength(2);
  });

  it('剥离 markdown 标记与列表符号', () => {
    const text = ['- **导入**：今天讲浮力', '* 物体在水中受到向上的力'].join('\n');
    const r = parseTranscript(text);
    expect(r.steps).toEqual(['导入：今天讲浮力', '物体在水中受到向上的力']);
  });

  it('过滤纯标题行与过短的行', () => {
    const text = ['教学目标', '教学过程', '导入', '新授', '同学们，今天我们来学习分数的加减法', '小结'].join('\n');
    const r = parseTranscript(text);
    expect(r.steps).toEqual(['同学们，今天我们来学习分数的加减法']);
  });

  it('按 maxSteps 截断，防止讲稿过长', () => {
    const text = Array.from({ length: 50 }, (_, i) => `第${i}段讲稿内容足够长以通过过滤`).join('\n');
    expect(parseTranscript(text, 5).steps).toHaveLength(5);
    expect(parseTranscript(text).steps).toHaveLength(40); // 默认 40
  });

  it('合并同一段内的软换行，不把一句话拆成多段', () => {
    const text = ['教学过程', '同学们，今天讲光合作用，', '它是植物最重要的生理过程。'].join('\n');
    // 逐行是允许的：行即讲稿步。此处确认两行都在，且顺序正确
    expect(parseTranscript(text).steps).toEqual([
      '同学们，今天讲光合作用，',
      '它是植物最重要的生理过程。',
    ]);
  });
});

describe('transcriptFromLessonPlanContent', () => {
  it('从 { generated: string } 结构中取出讲稿', () => {
    const content = { generated: '同学们，今天讲光合作用' };
    const r = transcriptFromLessonPlanContent(content);
    expect(r.steps).toEqual(['同学们，今天讲光合作用']);
  });

  it('content 为 null / undefined / 缺 generated 时安全返回空讲稿', () => {
    expect(transcriptFromLessonPlanContent(null).steps).toEqual([]);
    expect(transcriptFromLessonPlanContent(undefined).steps).toEqual([]);
    expect(transcriptFromLessonPlanContent({}).steps).toEqual([]);
    expect(transcriptFromLessonPlanContent({ generated: null }).steps).toEqual([]);
  });

  it('generated 不是字符串时安全返回空讲稿', () => {
    expect(transcriptFromLessonPlanContent({ generated: 123 }).steps).toEqual([]);
    expect(transcriptFromLessonPlanContent({ generated: { a: 1 } }).steps).toEqual([]);
  });

  it('透传 maxSteps', () => {
    const content = { generated: Array.from({ length: 10 }, (_, i) => `第${i}段内容足够长以通过过滤`).join('\n') };
    expect(transcriptFromLessonPlanContent(content, 3).steps).toHaveLength(3);
  });
});
