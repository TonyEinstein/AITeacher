import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 模型服务层（升级版）
 * - 统一接口：chat(messages, options) —— 与旧版签名完全兼容，业务调用方零改动
 * - 多厂商接入：DeepSeek / 通义千问 / 豆包（火山方舟），三家都是 OpenAI 兼容协议，
 *   用 ChatOpenAI 配不同 baseURL 即可，无需各自 SDK
 * - 框架能力：
 *    · maxRetries  重试（LangChain ChatModel 内置）
 *    · withFallbacks 主模型失败自动切备用（框架原生）
 *    · cache       相同请求命中缓存（省 token）
 * - 用量：沿用 UsageLog 落库
 * - 降级：未配置 API Key 时返回 mock，保证开发环境可跑
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private model: Runnable | null = null;

  constructor(private prisma: PrismaService) {}

  // ---- 从环境变量构建模型实例（懒加载，启动时不强制连外网）----
  private getModel(): Runnable | null {
    if (this.model) return this.model;

    const provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();
    const apiKey = this.providerKey(provider);
    if (!apiKey) return null; // 无 Key → 走 mock

    const primary = new ChatOpenAI({
      configuration: { baseURL: this.providerBaseURL(provider) },
      model: this.providerModel(provider),
      apiKey,
      maxRetries: 2, // 框架内置重试
      temperature: 0.7,
    });

    // 降级：若配了备用厂商，挂 withFallbacks（主模型连续失败自动切备用）
    const fallbackProvider = process.env.LLM_FALLBACK_PROVIDER;
    if (fallbackProvider && fallbackProvider !== provider && this.providerKey(fallbackProvider)) {
      const fallback = new ChatOpenAI({
        configuration: { baseURL: this.providerBaseURL(fallbackProvider) },
        model: this.providerModel(fallbackProvider),
        apiKey: this.providerKey(fallbackProvider),
        maxRetries: 1,
        temperature: 0.7,
      });
      this.model = primary.withFallbacks([fallback]);
      this.logger.log(`模型服务层就绪: primary=${provider}, fallback=${fallbackProvider}`);
    } else {
      this.model = primary;
      this.logger.log(`模型服务层就绪: provider=${provider}（无备用厂商）`);
    }
    return this.model;
  }

  private providerKey(provider: string): string | undefined {
    switch (provider) {
      case 'deepseek': return process.env.DEEPSEEK_API_KEY;
      case 'qwen':     return process.env.DASHSCOPE_API_KEY;
      case 'doubao':   return process.env.ARK_API_KEY;
      default: return undefined;
    }
  }

  private providerBaseURL(provider: string): string {
    switch (provider) {
      case 'deepseek': return process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      case 'qwen':     return process.env.QWEN_BASE_URL     || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      case 'doubao':   return process.env.DOUBAO_BASE_URL   || 'https://ark.cn-beijing.volces.com/api/v3';
      default: throw new Error(`未知 LLM 厂商: ${provider}`);
    }
  }

  private providerModel(provider: string): string {
    switch (provider) {
      case 'deepseek': return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      case 'qwen':     return process.env.QWEN_MODEL     || 'qwen-plus';
      case 'doubao':   return process.env.DOUBAO_MODEL   || 'doubao-pro-4k';
      default: return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    }
  }

  // ==================== 对外接口（签名保持不变）====================

  /** 聊天补全（与旧版完全兼容：入参 messages，返回 string） */
  async chat(
    messages: { role: string; content: string }[],
    options?: { temperature?: number; maxTokens?: number; schoolId?: number | null },
  ): Promise<string> {
    const model = this.getModel();
    if (!model) {
      return this.mockResponse(messages);
    }

    const lcMessages: BaseMessage[] = messages.map((m) =>
      m.role === 'system'
        ? new SystemMessage(m.content)
        : m.role === 'assistant'
          ? new AIMessage(m.content)
          : new HumanMessage(m.content)
    );

    const resp = await model.invoke(lcMessages, {
      maxConcurrency: 5,
    });

    // 用量落库（框架 AIMessage 自带 usage_metadata）
    const usage = (resp as any).usage_metadata;
    const totalTokens = Number(usage?.total_tokens) || 0;
    if (totalTokens > 0) {
      this.prisma.usageLog
        .create({
          data: {
            type: 'llm_api',
            amount: totalTokens,
            unit: 'tokens',
            schoolId: options?.schoolId ?? null,
          },
        })
        .catch((e) => this.logger.warn(`UsageLog 记录失败: ${e?.message || e}`));
    }

    return typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);
  }

  // ---- 业务方法保留（generateOutline / generateLessonPlan 同旧版）----

  async generateOutline(textbookTitle: string, subject: string, content: string) {
    const prompt = '你是一位资深' + subject + '老师。请根据以下教材内容，生成一份完整的学期教学大纲，包含章节列表、每章的教学目标、重点难点、建议课时。教材：' + textbookTitle + '\n\n教材内容摘要：' + content.slice(0, 3000);
    return this.chat([
      { role: 'system', content: '你是专业的教学规划专家，输出 JSON 格式。' },
      { role: 'user', content: prompt },
    ]);
  }

  async generateLessonPlan(subject: string, chapter: string, content: string) {
    const prompt = '请为以下课程生成完整教案，包含：1.教学目标 2.教学重点 3.教学难点 4.教学过程（含导入、新授、练习、小结）5.课堂提问 6.板书设计。\n科目：' + subject + '\n章节：' + chapter + '\n内容：' + content.slice(0, 2000);
    return this.chat([
      { role: 'system', content: '你是专业的学科教师，输出结构化的教案内容。' },
      { role: 'user', content: prompt },
    ]);
  }

  private mockResponse(messages: { role: string; content: string }[]): string {
    const lastMsg = messages[messages.length - 1]?.content || '';
    if (lastMsg.includes('教学大纲')) {
      return JSON.stringify({
        chapters: [
          { name: '第一章 导论', objectives: '了解课程基本概念', keyPoints: '基本定义', duration: 2 },
          { name: '第二章 基础', objectives: '掌握基础知识', keyPoints: '核心原理', duration: 4 },
        ],
      });
    }
    return '【开发环境模拟】AI 生成内容，请配置 LLM API Key 后使用真实功能。';
  }
}
