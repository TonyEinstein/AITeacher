// @qiun/ucharts 无类型声明（package.json 无 types 字段，入口为 u-charts.js）。
// 本文件不含任何 import/export，故为 ambient 模块声明，可被全局识别。
// 构造签名：new uCharts(opts)，opts.context 必需（v2 起要求自行传入 canvas 上下文）。
declare module '@qiun/ucharts' {
  const uCharts: any
  export default uCharts
}