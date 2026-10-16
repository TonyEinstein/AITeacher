-- 数据隔离验证 SQL
-- 验证：不同学校的视觉事件互不干扰

-- 1. 查看所有事件及其所属学校
SELECT
  be.id,
  be.type,
  be.category,
  be."startTime",
  lr."classId",
  c."gradeId",
  g."schoolId"
FROM "BehaviorEvent" be
JOIN "LessonRecord" lr ON be."lessonRecordId" = lr.id
JOIN "Class" c ON lr."classId" = c.id
JOIN "Grade" g ON c."gradeId" = g.id
ORDER BY be."startTime" DESC
LIMIT 20;

-- 2. 验证：按 schoolId 过滤事件
-- 假设 schoolId=1
SELECT count(*) as school1_events
FROM "BehaviorEvent" be
JOIN "LessonRecord" lr ON be."lessonRecordId" = lr.id
JOIN "Class" c ON lr."classId" = c.id
JOIN "Grade" g ON c."gradeId" = g.id
WHERE g."schoolId" = 1;

-- 3. 验证：按 lessonRecordId 隔离（API 查询方式）
SELECT count(*) FROM "BehaviorEvent" WHERE "lessonRecordId" = 1;
SELECT count(*) FROM "BehaviorEvent" WHERE "lessonRecordId" = 2;

-- 4. 分钟聚合表也同样按 lessonRecordId 隔离
SELECT count(*) FROM "ClassMinuteAggregate" WHERE "lessonRecordId" = 1;
