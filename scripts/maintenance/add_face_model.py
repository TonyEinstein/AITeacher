# -*- coding: utf-8 -*-
"""给 schema.prisma 追加 FacePhoto 模型"""
import io
path = r'E:\AITeacher\backend\prisma\schema.prisma'
with io.open(path, 'r', encoding='utf-8') as f:
    c = f.read()

if 'model FacePhoto' not in c:
    # 在 Student 模型的反向关系中加 facePhotos
    # 先找 Student 模型，在它的关系字段里加
    import re
    # 在 model Student { ... } 块中找 devices 字段后加 facePhotos
    student_match = re.search(r'(model Student \{[^}]+\})', c, re.DOTALL)
    if student_match and 'facePhotos' not in student_match.group(1):
        old_student = student_match.group(1)
        # 在 tutoringSubscription 后加 facePhotos
        if 'tutoringSubscription' in old_student:
            new_student = old_student.replace(
                'tutoringSubscription TutoringSubscription?',
                'tutoringSubscription TutoringSubscription?\n  facePhotos FacePhoto[]'
            )
        else:
            # 在 devices 后加
            new_student = old_student.replace(
                'devices Device[]',
                'devices Device[]\n  facePhotos FacePhoto[]'
            )
        c = c.replace(old_student, new_student)

    # 追加 FacePhoto 模型到文件末尾
    face_model = '''

// ====================
// 人脸库相关表
// ====================

model FacePhoto {
  id            Int      @id @default(autoincrement())
  studentId     Int
  student       Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  photoUrl      String   // MinIO 存储的人脸照片URL
  featureVector String?  // 盒子端提取的128维特征向量(JSON数组)，回传后存储
  status        String   @default("pending") // pending待处理, processed已提取特征, failed失败, synced已下发盒子
  boxId         Int?     // 下发到哪个教室盒子
  uploadedBy    Int?     // 上传者用户ID
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([studentId])
  @@index([status])
}
'''
    c = c + face_model
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('FacePhoto 模型已追加，Student反向关系已加')
else:
    print('FacePhoto 模型已存在')
