/**
 * 学生学科薄弱画像（PRD §3.25）
 *
 * 从错题本按「知识点」聚合，算出薄弱点排序。
 *
 * ⚠️ 口径说明：本函数基于**错题数**，不是真实「错误率」——
 * 系统目前没有记录「某知识点一共练了多少题」（`PracticeRecord` 不含知识点），
 * 算不出分母。所以输出的是「错得最多、且近期仍在错的知识点」，
 * 而不是「错误率最高的知识点」。后续若补齐练习总题数，可在此基础上换成真实错误率。
 *
 * 纯函数：无副作用、无 IO，`now` 可注入以便测试。
 */

/** 近期窗口（天） */
export const RECENT_DAYS = 30;
/** 近期错题的加权系数：每道近期错题额外计 0.5 分，强调「还在错」的知识点 */
const RECENT_BONUS = 0.5;
const DEFAULT_TOP_N = 5;
/** 摘要里最多列出几个知识点 */
const SUMMARY_SIZE = 3;

export interface WrongQuestionRecord {
  knowledgePoint: string | null;
  createdAt: Date | string;
}

export interface WeaknessItem {
  knowledgePoint: string;
  /** 该知识点累计错题数 */
  wrongCount: number;
  /** 其中最近 RECENT_DAYS 天内的错题数 */
  recentCount: number;
  /** 占「已归类错题」的百分比（合计约 100） */
  sharePercent: number;
  /** 薄弱分：wrongCount + recentCount * 0.5，降序依据 */
  score: number;
  /** 该知识点最近一次错题时间（ISO） */
  latestAt: string | null;
}

export interface WeaknessResult {
  totalWrong: number;
  /** 有知识点归属的错题数 */
  classified: number;
  /** 无知识点归属的错题数（老数据或题目未带知识点） */
  unclassified: number;
  items: WeaknessItem[];
  /** 可直接展示/落库的摘要，如「光合作用(错3题)、细胞呼吸(错2题)」 */
  summary: string;
}

export function computeWeaknesses(
  records: WrongQuestionRecord[],
  topN = DEFAULT_TOP_N,
  now: Date = new Date(),
): WeaknessResult {
  const list = records ?? [];
  const totalWrong = list.length;
  const cutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;

  const agg = new Map<string, { wrongCount: number; recentCount: number; latest: number }>();
  let unclassified = 0;

  for (const r of list) {
    const kp = (r.knowledgePoint ?? '').trim();
    if (!kp) {
      unclassified += 1;
      continue;
    }
    const at = new Date(r.createdAt).getTime();
    const cur = agg.get(kp) ?? { wrongCount: 0, recentCount: 0, latest: 0 };
    cur.wrongCount += 1;
    if (at >= cutoff) cur.recentCount += 1;
    if (at > cur.latest) cur.latest = at;
    agg.set(kp, cur);
  }

  const classified = totalWrong - unclassified;
  const limit = Number.isFinite(topN) ? Math.max(0, Math.floor(topN)) : DEFAULT_TOP_N;

  const items: WeaknessItem[] = [...agg.entries()]
    .map(([knowledgePoint, v]) => ({
      knowledgePoint,
      wrongCount: v.wrongCount,
      recentCount: v.recentCount,
      sharePercent: classified ? Math.round((v.wrongCount / classified) * 1000) / 10 : 0,
      score: Math.round((v.wrongCount + v.recentCount * RECENT_BONUS) * 10) / 10,
      latestAt: v.latest ? new Date(v.latest).toISOString() : null,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.wrongCount - a.wrongCount ||
        a.knowledgePoint.localeCompare(b.knowledgePoint),
    )
    .slice(0, limit);

  const summary = items
    .slice(0, SUMMARY_SIZE)
    .map((i) => `${i.knowledgePoint}(错${i.wrongCount}题)`)
    .join('、');

  return { totalWrong, classified, unclassified, items, summary };
}
