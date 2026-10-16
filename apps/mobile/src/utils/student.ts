/** 学生工具：获取当前登录学生 ID（未登录则引导去登录） */
export function getStudentId(): number | null {
  const id = uni.getStorageSync('studentId');
  if (!id) {
    uni.showModal({
      title: '请先登录',
      content: '需要登录并绑定学生后才能查看此内容',
      confirmText: '去登录',
      success: (r) => {
        if (r.confirm) uni.reLaunch({ url: '/pages/login/index' });
      },
    });
    return null;
  }
  return Number(id);
}

/** 获取当前登录学生的展示信息 */
export function getStudentInfo(): any {
  return uni.getStorageSync('studentInfo') || null;
}

export function getRole(): string {
  return uni.getStorageSync('role') || 'student';
}
