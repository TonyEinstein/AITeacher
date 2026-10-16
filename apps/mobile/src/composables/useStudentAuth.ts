import { onShow } from '@dcloudio/uni-app';
import { isLogin } from '@/utils/auth';

/**
 * 学生页登录守卫组合式。
 *
 * 用法：`useStudentAuth(() => { ...页面加载逻辑 })`。
 * 注册单一 onShow：先校验登录态与学生绑定，失败时 reLaunch 登录页并**短路**
 * （不执行 load）——与改造前 `if (!isLogin()) { reLaunch; return }` 行为一致，
 * 未登录时不发任何请求、不触发任何副作用。
 * 校验通过后执行传入的 load 回调（各页原 onShow 内的加载逻辑原样移入）。
 *
 * 双校验（isLogin + studentId）：
 * - 无 token：reLaunch 登录页；
 * - 有 token 无 studentId（如微信未绑定家长的登录态）：同样回登录页，
 *   避免落到学生页后由 getStudentId() 弹出多余的「请先登录」模态框。
 */
export function useStudentAuth(load?: () => void) {
  onShow(() => {
    const studentId = uni.getStorageSync('studentId');
    if (!isLogin() || !studentId) {
      uni.reLaunch({ url: '/pages/login/index' });
      return;
    }
    load?.();
  });
}
