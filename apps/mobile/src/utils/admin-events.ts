/**
 * 管理端页面刷新事件
 *
 * 背景：H5 hash 路由下，点击侧栏「当前高亮的菜单」不会重建页面、
 * 也不会触发 onShow（uni-app 框架行为）。AdminLayout 的 go() 在这种
 * 情况下广播本事件；需要「点当前菜单=刷新」语义的页面用
 * onAdminRefresh() 挂监听（见下）。
 */
export const ADMIN_PAGE_REFRESH = 'admin:page-refresh'

import { onMounted, onUnmounted } from 'vue'

/** 页面挂载期间监听刷新广播（onShow 的补位，组件卸载自动解绑） */
export function onAdminRefresh(cb: () => void) {
  const handler = () => cb()
  onMounted(() => uni.$on(ADMIN_PAGE_REFRESH, handler))
  onUnmounted(() => uni.$off(ADMIN_PAGE_REFRESH, handler))
}
