<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style lang="scss">
/* 自托管宋体 display 字面（Noto Serif SC 700/900 分片子集）——
   必须先于 site.scss 声明，确保 display 声音是命名字体而非系统衬线兜底 */
@import '@/styles/fonts.css';
/* 官网水墨风全局主题：必须全局注入（App.vue 的 style 无 scoped 即全局）。
   之前放在 SiteShell.vue 的 <style> 里，被编译器按组件 scope 打上
   data-v-hash，而主题作用的目标元素（页面 slot 内容）scope 归各页面组件，
   两套 hash 对不上 → 整站样式全部失效只剩裸文本。 */
@import '@/styles/site.scss';
</style>
