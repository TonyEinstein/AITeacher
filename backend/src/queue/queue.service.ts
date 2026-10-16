import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';

/**
 * 异步任务队列服务
 * 耗时任务（AI 批改、OCR 解析、消息推送、评估生成）入队列异步处理，
 * 避免阻塞 HTTP 请求。基于 BullMQ + Redis。
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  private readonly connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };

  // 队列定义
  queues: Record<string, Queue> = {};
  private workers: Worker[] = [];

  // 队列名称常量
  static readonly AI_GRADING = 'ai-grading';       // AI 作业批改
  static readonly OCR = 'ocr';                       // 教材 OCR 解析
  static readonly NOTIFICATION = 'notification';     // 消息推送（微信/邮件）
  static readonly EVALUATION = 'evaluation';         // 课后评估生成
  static readonly REPORT = 'report';                 // 综合报告生成

  private readonly queueNames = [
    QueueService.AI_GRADING,
    QueueService.OCR,
    QueueService.NOTIFICATION,
    QueueService.EVALUATION,
    QueueService.REPORT,
  ];

  onModuleInit() {
    // 初始化所有队列
    for (const name of this.queueNames) {
      this.queues[name] = new Queue(name, { connection: this.connection });
      this.logger.log(`队列已初始化: ${name}`);
    }

    // 启动 Worker（开发环境在同一进程，生产环境可独立部署）
    this.startWorkers();
  }

  /**
   * 添加任务到队列
   */
  async addJob(queueName: string, data: any, opts?: { delay?: number; priority?: number }): Promise<Job> {
    const queue = this.queues[queueName];
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    const job = await queue.add('process', data, {
      delay: opts?.delay,
      priority: opts?.priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    this.logger.debug(`任务已入队 [${queueName}]: jobId=${job.id}`);
    return job;
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(queueName: string, jobId: string): Promise<string> {
    const queue = this.queues[queueName];
    if (!queue) return 'unknown';
    const job = await queue.getJob(jobId);
    if (!job) return 'not_found';
    return await job.getState();
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(queueName: string) {
    const queue = this.queues[queueName];
    if (!queue) return null;
    return await queue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
  }

  /**
   * 启动 Worker 处理任务
   * 注意：实际业务处理逻辑在各自 service 中，
   * Worker 中通过事件回调触发，这里做基础框架与日志记录。
   */
  private startWorkers() {
    for (const name of this.queueNames) {
      const worker = new Worker(
        name,
        async (job: Job) => {
          this.logger.log(`处理任务 [${name}] jobId=${job.id}, data=${JSON.stringify(job.data).slice(0, 200)}`);
          // 实际处理逻辑由各模块通过 registerHandler 注册
          const handler = this.handlers.get(name);
          if (handler) {
            return await handler(job.data);
          }
          // 无注册处理器时，记录并标记完成（避免任务堆积）
          this.logger.warn(`队列 [${name}] 无注册处理器，任务跳过`);
          return { skipped: true };
        },
        { connection: this.connection, concurrency: 5 },
      );

      worker.on('completed', (job) => {
        this.logger.log(`任务完成 [${name}] jobId=${job.id}`);
      });

      worker.on('failed', (job, err) => {
        this.logger.error(`任务失败 [${name}] jobId=${job?.id}: ${err.message}`);
      });

      this.workers.push(worker);
    }
  }

  // 外部注册的任务处理器
  private handlers = new Map<string, (data: any) => Promise<any>>();

  /**
   * 注册队列任务处理器
   * 各业务模块调用此方法注册自己的处理逻辑
   */
  registerHandler(queueName: string, handler: (data: any) => Promise<any>) {
    this.handlers.set(queueName, handler);
    this.logger.log(`已注册队列处理器: ${queueName}`);
  }

  onModuleDestroy() {
    // 关闭所有 Worker 和队列
    for (const worker of this.workers) {
      worker.close().catch(() => {});
    }
    for (const name of this.queueNames) {
      this.queues[name]?.close().catch(() => {});
    }
    this.logger.log('队列服务已关闭');
  }
}
