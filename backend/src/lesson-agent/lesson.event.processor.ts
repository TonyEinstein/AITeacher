import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker, Job } from "bullmq";
import { LessonAgentService, LessonMeta } from "./lesson.agent.service";

export interface LessonEventJob {
  meta: LessonMeta;
  event: { student: string; question: string };
}

/**
 * 课堂事件接入：教室端上报的"学生举手/提问"事件进 BullMQ，
 * Worker 取出后 resume 对应课堂会话。
 * - 与现有 QueueService 解耦：本模块自管队列 lesson-event
 * - 事件与图解耦：图在 interrupt 挂起，事件来了才唤醒
 */
@Injectable()
export class LessonEventProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LessonEventProcessor.name);
  static readonly QUEUE = "lesson-event";

  private readonly connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  };

  private queue!: Queue;
  private worker!: Worker;

  constructor(private readonly agent: LessonAgentService) {}

  onModuleInit() {
    this.queue = new Queue(LessonEventProcessor.QUEUE, { connection: this.connection });
    this.worker = new Worker(
      LessonEventProcessor.QUEUE,
      async (job: Job<LessonEventJob>) => {
        const { meta, event } = job.data;
        this.logger.log(`处理课堂事件: school=${meta.schoolId} class=${meta.classId} student=${event.student}`);
        await this.agent.resumeLesson(meta, event);
        return { ok: true };
      },
      { connection: this.connection, concurrency: 10 }
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`课堂事件处理失败: jobId=${job?.id} ${err.message}`);
    });
    this.logger.log("课堂事件队列 lesson-event 已就绪");
  }

  /** 外部（controller/网关）调用：把课堂事件入队 */
  async enqueue(meta: LessonMeta, event: { student: string; question: string }) {
    await this.queue.add("lesson-event", { meta, event }, { attempts: 3, backoff: { type: "exponential", delay: 2000 } });
  }

  async onModuleDestroy() {
    await this.queue?.close().catch(() => {});
    await this.worker?.close().catch(() => {});
  }
}
