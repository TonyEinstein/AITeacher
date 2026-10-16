/**
 * 课堂答疑的上下文构造（轻量「检索」）。
 *
 * 不引入分词器或向量库：中文短句用 **2-gram（连续两字）重合度** 衡量相关度，
 * 足以在「本课讲稿 + 学科知识点」这种小候选集里挑出相关内容，
 * 避免把无关段落塞进 prompt 污染回答。
 *
 * 纯函数：无副作用、无 IO，可直接单测。
 */

/** 去掉空白、标点、符号，只留可比较的字符 */
function normalize(input: string): string {
  return (input || '').replace(/[\s\p{P}\p{S}]/gu, '');
}

function bigramsOf(cleaned: string): Set<string> {
  const out = new Set<string>();
  if (cleaned.length === 1) {
    out.add(cleaned);
    return out;
  }
  for (let i = 0; i + 1 < cleaned.length; i += 1) out.add(cleaned.slice(i, i + 2));
  return out;
}

/**
 * 相关度：0（完全无关）~ 1（完全命中）。
 * 单字查询退化为包含判断。
 */
export function relevanceScore(query: string, text: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const t = normalize(text);
  if (!t) return 0;

  if (q.length === 1) return t.includes(q) ? 1 : 0;

  const qGrams = bigramsOf(q);
  if (!qGrams.size) return 0;
  const tGrams = bigramsOf(t);

  let hit = 0;
  for (const g of qGrams) if (tGrams.has(g)) hit += 1;
  return hit / qGrams.size;
}

/** 按相关度降序挑出候选片段；**无重合的片段不会被返回**（宁缺毋滥） */
export function rankRelevantChunks(query: string, chunks: string[], topK = 3): string[] {
  const limit = Math.max(0, Math.floor(topK));
  if (!limit || !chunks?.length) return [];
  return chunks
    .map((chunk) => ({ chunk, score: relevanceScore(query, chunk) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.chunk);
}

export interface QaContextInput {
  /** 学生提问 */
  question: string;
  /** 课题 */
  lessonTitle: string;
  /** 本课讲稿（来自教案解析） */
  transcript: string[];
  /** 同学科知识点（来自题库） */
  knowledgePoints: string[];
  /** 讲稿/知识点各取前 K 条 */
  topK?: number;
  /** 上下文最大字符数 */
  maxChars?: number;
}

const DEFAULT_TOP_K = 3;
const DEFAULT_MAX_CHARS = 1500;

/**
 * 组装答疑用的上下文文本。
 * 只放与问题相关的内容；没有相关内容时只保留课题，不硬塞。
 */
export function buildQaContext(input: QaContextInput): string {
  const { question, lessonTitle, transcript, knowledgePoints } = input;
  const topK = input.topK ?? DEFAULT_TOP_K;
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;

  const parts: string[] = [`【课题】${lessonTitle}`];

  const chunks = rankRelevantChunks(question, transcript ?? [], topK);
  if (chunks.length) {
    parts.push(`【本课相关讲授内容】\n${chunks.join('\n')}`);
  }

  const points = rankRelevantChunks(question, knowledgePoints ?? [], topK);
  if (points.length) {
    parts.push(`【相关知识点】${points.join('、')}`);
  }

  const context = parts.join('\n');
  return context.length > maxChars ? context.slice(0, maxChars) : context;
}
