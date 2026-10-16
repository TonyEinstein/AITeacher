import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SchoolsModule } from './schools/schools.module';
import { GradesModule } from './grades/grades.module';
import { ClassesModule } from './classes/classes.module';
import { StudentsModule } from './students/students.module';
import { UsersModule } from './users/users.module';
import { ParentsModule } from './parents/parents.module';
import { WechatModule } from './wechat/wechat.module';
import { MinioModule } from './minio/minio.module';
import { LlmModule } from './llm/llm.module';
import { TextbooksModule } from './textbooks/textbooks.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { SchedulesModule } from './schedules/schedules.module';
import { RoomsModule } from './rooms/rooms.module';
import { BoxesModule } from './boxes/boxes.module';
import { AgentsModule } from './agents/agents.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LessonRecordsModule } from './lesson-records/lesson-records.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { WrongQuestionsModule } from './wrong-questions/wrong-questions.module';
import { ExamsModule } from './exams/exams.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ParentMessagesModule } from './parent-messages/parent-messages.module';
import { LiveModule } from './live/live.module';
import { SharesModule } from './shares/shares.module';
import { TutoringModule } from './tutoring/tutoring.module';
import { PreferencesModule } from './preferences/preferences.module';
import { SurveysModule } from './surveys/surveys.module';
import { AvatarsModule } from './avatars/avatars.module';
import { LeavesModule } from './leaves/leaves.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CampusesModule } from './campuses/campuses.module';
import { QuestionBankModule } from './question-bank/question-bank.module';
import { RankingsModule } from './rankings/rankings.module';
import { WearableModule } from './wearable/wearable.module';
import { FaceLibraryModule } from './face-library/face-library.module';
import { MediaStreamModule } from './media-stream/media-stream.module';
import { QueueModule } from './queue/queue.module';
import { LeadsModule } from './leads/leads.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { TrackingModule } from './tracking/tracking.module';
import { LessonAgentModule } from './lesson-agent/lesson.agent.module';
import { VisionModule } from './vision/vision.module';
import { AlertsModule } from './alerts/alerts.module';
import { TeachersModule } from './teachers/teachers.module';
import { PracticeModule } from './practice/practice.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    // 全局接口限流（PRD §17）：每 IP 每分钟 60 次；Redis 不可用时 throttler 自动退化为内存计数
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: parseInt(process.env.RATE_LIMIT_PER_MIN || '60', 10),
      },
    ]),
    PrismaModule,
    MinioModule,
    LlmModule,
    HttpModule,
    AuthModule,
    SchoolsModule,
    GradesModule,
    ClassesModule,
    StudentsModule,
    UsersModule,
    ParentsModule,
    WechatModule,
    TextbooksModule,
    LessonPlansModule,
    SchedulesModule,
    RoomsModule,
    BoxesModule,
    AgentsModule,
    RealtimeModule,
    LessonRecordsModule,
    AssignmentsModule,
    WrongQuestionsModule,
    ExamsModule,
    EvaluationsModule,
    DashboardModule,
    ParentMessagesModule,
    LiveModule,
    SharesModule,
    TutoringModule,
    PreferencesModule,
    SurveysModule,
    AvatarsModule,
    LeavesModule,
    NotificationsModule,
    CampusesModule,
    QuestionBankModule,
    RankingsModule,
    WearableModule,
    FaceLibraryModule,
    MediaStreamModule,
    QueueModule,
    LeadsModule,
    SubscriptionsModule,
    WorkOrdersModule,
    SubjectsModule,
    SiteConfigModule,
    TrackingModule,
    LessonAgentModule,
    VisionModule,
    AlertsModule,
    TeachersModule,
    PracticeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局限流守卫（装饰器可按路由覆盖：@Throttle/@SkipThrottle）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}