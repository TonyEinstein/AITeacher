/**
 * 官网页跳转组合式。
 *
 * H5 端 navigateTo 压栈（可后退）；小程序 / App 端保持 reLaunch（页栈浅，避免堆栈上限）。
 * 原为 pages-site 下 5 个文件各自重复的本地 go()，收敛于此。
 */
export function useSiteNav() {
  function go(url: string) {
    // #ifdef H5
    uni.navigateTo({ url });
    // #endif
    // #ifndef H5
    uni.reLaunch({ url });
    // #endif
  }

  return { go };
}
