/**
 * 教案正文解析：把 LLM 生成的结构化教案文本，转成可逐段讲授的讲稿。
 *
 * 教案 `LessonPlan.content` 的形状是 `{ generated: string }`，
 * `generated` 是按「教学目标 / 教学重点 / 教学过程 / 课堂提问 / 板书设计」分节的中文文本。
 * 数字人上课**只应讲「教学过程」那一段**，其余是给老师备课看的，不该念出来。
 *
 * 纯函数：无副作用、无 IO，可直接单测。
 */

export type TranscriptSource = 'process_section' | 'full_text' | 'empty';

export interface TranscriptParseResult {
  /** 逐段讲稿，顺序即讲授顺序 */
  steps: string[];
  /** 讲稿来源：取了「教学过程」段落 / 用了全文 / 空 */
  source: TranscriptSource;
}

/** 纯标题行（只有标题没有正文），解析时丢弃 */
const HEADER_NAMES = [
  '教学目标',
  '教学重点',
  '教学难点',
  '教学过程',
  '课堂提问',
  '板书设计',
  '导入',
  '新授',
  '练习',
  '小结',
  '作业',
  '课后反思',
  '教学反思',
];

/** 这些标题出现即代表「教学过程」段落结束 */
const SECTION_END_NAMES = [
  '教学目标',
  '教学重点',
  '教学难点',
  '课堂提问',
  '板书设计',
  '作业',
  '课后反思',
  '教学反思',
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HEADER_RE = new RegExp(`^(?:${HEADER_NAMES.map(escapeRe).join('|')})\\s*[:：]?$`);
const PROCESS_RE = /^教学过程\s*[:：]?$/;
const SECTION_END_RE = new RegExp(`^(?:${SECTION_END_NAMES.map(escapeRe).join('|')})\\s*[:：]?$`);

/** 短于此长度的行视为标题/噪声，不作为讲稿 */
const MIN_STEP_LENGTH = 4;
const DEFAULT_MAX_STEPS = 40;

/** 剥离 markdown 与列表标记，保留正文 */
function cleanLine(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*+>]\s*/, '')
    .replace(/^\s*\d+[.、)]\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
}

export function parseTranscript(
  generated: string,
  maxSteps = DEFAULT_MAX_STEPS,
): TranscriptParseResult {
  if (typeof generated !== 'string' || !generated.trim()) {
    return { steps: [], source: 'empty' };
  }

  const lines = generated.replace(/\r\n?/g, '\n').split('\n').map(cleanLine);

  // 定位「教学过程」；找不到就退回全文
  const startIdx = lines.findIndex((l) => PROCESS_RE.test(l));
  let body: string[];
  let source: TranscriptSource;

  if (startIdx >= 0) {
    body = [];
    for (let i = startIdx + 1; i < lines.length; i += 1) {
      if (SECTION_END_RE.test(lines[i])) break;
      body.push(lines[i]);
    }
    source = 'process_section';
  } else {
    body = lines;
    source = 'full_text';
  }

  const limit = Number.isFinite(maxSteps) ? Math.max(0, Math.floor(maxSteps)) : DEFAULT_MAX_STEPS;
  const steps = body
    .filter((l) => l.length >= MIN_STEP_LENGTH && !HEADER_RE.test(l))
    .slice(0, limit);

  if (!steps.length) return { steps: [], source: 'empty' };
  return { steps, source };
}

/** 从 `LessonPlan.content`（Prisma Json）安全取出讲稿；结构不符时返回空 */
export function transcriptFromLessonPlanContent(
  content: unknown,
  maxSteps = DEFAULT_MAX_STEPS,
): TranscriptParseResult {
  const generated = (content as { generated?: unknown } | null | undefined)?.generated;
  if (typeof generated !== 'string') return { steps: [], source: 'empty' };
  return parseTranscript(generated, maxSteps);
}
