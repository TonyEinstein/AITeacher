---
name: AI Teacher 智能教学引擎
description: 东方水墨气度的智能教学官网视觉系统——宣纸为底、远山立骨、朱砂点睛
colors:
  paper: "#FBFAF7"
  ink: "#2b2b2b"
  ink-soft: "#4a4a4a"
  muted: "#7a8a96"
  cinnabar: "#8b2e2e"
  cinnabar-deep: "#6e2222"
  jade: "#4a6b5a"
  line: "rgba(43, 43, 43, 0.08)"
  ridge-far: "#8fa0a6"
  ridge-mid: "#5f747b"
  ridge-near: "#3d5257"
  ridge-fore: "#2b3a3e"
  night-ground: "#17191d"
typography:
  display:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontWeight: 900
    letterSpacing: "6px"
  headline:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontWeight: 700
    letterSpacing: "8px"
  body:
    fontFamily: "Noto Sans SC, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "Noto Sans SC, sans-serif"
    fontWeight: 400
    letterSpacing: "3px"
rounded:
  pill: "999px"
  card: "26px"
  seal: "12px"
  modal: "24px"
spacing:
  section: "110px"
  container: "1200px"
  row: "30px"
components:
  button-primary:
    backgroundColor: "{colors.cinnabar}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "16px 36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "16px 36px"
  nav-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "14px 32px"
  seal-tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ridge-near}"
    rounded: "{rounded.seal}"
    padding: "0"
---

# Design System: AI Teacher 智能教学引擎

## Overview

**Creative North Star: "宣纸上的远山"（The Distant Ridges on Xuan Paper）**

这是一套以东方水墨为精神内核的教学产品视觉系统。它不追求科技品类惯用的蓝紫渐变与玻璃拟态，而是把官网当作一张铺开的宣纸：纸白为底、花青远山立骨、朱砂点睛。标题用宋体题字式排布，正文与控件用无衬线保持可读与克制。

密度低、留白大。深度不靠阴影堆砌，而靠细线描边、山雾渐隐与四重山脊的层叠视差。唯一的高饱和色是朱砂，只留给真正的行动点——它的稀缺就是它的力量。

**Key Characteristics:**
- 宣纸白 #FBFAF7 地色，拒绝纯白与暖奶油漂移
- 四重花青远山剪影 + 滚动视差（0.05/0.10/0.15/0.22）为签名交互
- 朱砂 #8b2e2e 唯一强调色
- 宋体 display（Noto Serif SC）+ 无衬线正文（Noto Sans SC）
- 细线描边立骨，零玻璃、零阴影堆砌
- 编辑式 ledger 行承载内容，拒绝等尺寸卡片网格

## Colors

调色板分三族：纸墨（中性）、朱砂（唯一强调）、花青（山脊景深）。

### Primary
- **Cinnabar 朱砂** (#8b2e2e): 唯一的行动与强调色——主按钮、副题、笔触分隔、胜列、数据行首。深阶 #6e2222 用于按压态。

### Neutral
- **Paper 宣纸白** (#FBFAF7): 全站地色与卡片/导航底。
- **Ink 墨** (#2b2b2b): 标题与主文字。
- **Ink-Soft 软墨** (#4a4a4a): 正文。
- **Muted 灰青** (#7a8a96): 次级说明、页脚。
- **Line 细线** (rgba(43,43,43,0.08)): 描边、分行、表格线。

### Tertiary（景深族）
- **Ridge 花青四色** (#8fa0a6 → #5f747b → #3d5257 → #2b3a3e): 由淡及浓的四重山脊，远→近。夜色场景（登录页）整体压入夜墨域但保持可读剪影。

### Named Rules
**The One-Accent Rule.** 朱砂是唯一的高饱和强调色，只出现在行动点与真正的强调处；任何第二强调色（绿/蓝/棕）都是缺陷。
**The Paper-Ground Rule.** 地色固定为宣纸白 #FBFAF7；不向暖奶油（cream）或冷石板（slate）漂移。

## Typography

**Display Font:** Noto Serif SC（Songti SC 兜底，serif）
**Body Font:** Noto Sans SC（sans-serif）

**Character:** 宋体题字负责「气度」，无衬线负责「可读」。标题宽字距（6–8px）模拟碑帖排布；正文不加字距。

### Hierarchy
- **Display** (900, 72px→42px 响应, line-height 1.25, letter-spacing 6px): hero 主标题「以 AI 为师」。
- **Headline** (700, 46px→32px, letter-spacing 8px): section 标题。
- **Title** (700, 21px, letter-spacing 2px): ledger 行题。
- **Body** (400, 15px, line-height 1.9): 卡片/行正文。
- **Label** (400, 13–14px, letter-spacing 3px): 按钮、band 题。

### Named Rules
**The Inscribed Rule.** 标题自己说话，不加 kicker/eyebrow 胶囊标签。

## Layout

单列居中叙事。容器 1200px；section 纵向 110px（窄屏 80px）。hero 占满首视口：文字靠上落在留白，底部 38% 交给四重远山。内容区用 ledger 行（细线分行、行首单字/数字）而非卡片网格；对比用三列细线表。窄屏（≤768px）行首缩小、表格列比调整。

## Elevation & Depth

本系统**不用阴影堆砌**。深度由三种手段传达：细线描边（1px line）立骨；山雾线性渐隐（mist）制造空气透视；四重山脊的透明度与视差制造景深。唯一的投影是浮动咨询按钮的朱砂光晕（0 12px 32px rgba(139,46,46,0.35)），作为强调点的功能表达，不作装饰范式。

### Named Rules
**The Flat-By-Default Rule.** 表面默认平铺；阴影只属于强调点的功能光晕，不属于卡片与表格。

## Shapes

圆角分档：控件全圆（999px 胶囊）；容器大圆（26px 卡/32px 联系盒）；印章小圆（12px 行首/方章）。描边一律 1px 细线，不用粗边、不用侧条纹。山脊为有机曲线剪影（SVG path），是唯一允许的有机形。

## Components

### Buttons
- **Shape:** 全圆胶囊（999px）
- **Primary:** 朱砂底白字，padding 16px 36px，letter-spacing 3px
- **Ghost:** 透明底、1px 细线描边、墨字
- **Hover/Focus:** 主按钮按压转 cinnabar-deep；ghost 描边加深

### Navigation
- **Style:** 悬浮纸白胶囊（fixed 居中），1px 细线描边，零玻璃零阴影；窄屏收为汉堡抽屉
- **Active:** 当前项朱砂字

### Ledger Row（签名组件）

> **2026-10-12 更新**：官网首页已按用户决策回归原版布局——卡片网格（bezel+card）恢复为页面结构，本 ledger 行仅保留在历史版本中。以下记录保留作为设计语汇参考。

- **Style:** 细线上下分行；行首为 56px 宋体单字方章（纸白底、花青描边）或朱砂数字；右侧行题+正文
- **用途:** 痛点/功能/方案/数据——替代等尺寸卡片网格

### Card Grid（当前官网页面结构）
- **bezel:** 1.5px 渐变描边外壳（28px 圆角），内嵌 26px 圆角白卡
- **icon:** 48px 渐变方块（朱砂/玉/蓝/棕四色），单字白文
- **hover:** bezel 上浮 6px + 柔和阴影
- **用途:** 痛点/功能/方案/数据各区

### Seal Tile（签名组件）
- **Style:** 12px 小圆方章，纸白底、花青四色描边之一、墨字单字
- **用途:** 行首与登录页朱砂方章「师」同源

### 登录页双栏（2026-10-12 更新）
- **桌面（>960px）:** 左品牌区（64px 朱砂方章 + 44px 宋体 name + 笔触分隔线带朱砂圆点 + 三条特性 + 四个价值胶囊）+ 右白卡（朱砂 3px 顶边、28px 宋体「欢迎登录」、双 tab、墨线输入、朱砂按钮、演示账号）
- **窄屏（≤960px）:** 单栏，品牌区紧凑化后登录卡接续
- **背景:** 与官网同源 InkSymbols 朱砂符号粒子；底色宣纸白 #FBFAF7

### Comparison Table
- **Style:** 白底、1px 细线外框与行线；表头纸白；胜列朱砂淡染（rgba(139,46,46,0.05)）+ 朱砂字

### Inputs / Fields
- **Style:** 1px 细线描边、14px 圆角、白底；深色场景（登录）改下划线墨线

## Do's and Don'ts

### Do:
- **Do** 让文字永远浮在留白之上，山脊沉底不压字。
- **Do** 用细线描边与山雾渐隐表达层次。
- **Do** 保持四重山脊的视差系数 0.05/0.10/0.15/0.22，并尊重 prefers-reduced-motion。
- **Do** 数据与联系方式未上线前以「示意/占位」标注，不虚构商业承诺。

### Don't:
- **Don't** 使用 kicker/eyebrow 胶囊标签——标题自己说话。
- **Don't** 用等尺寸「图标+标题+正文」卡片网格作页面结构；用 ledger 行。
- **Don't** 引入玻璃（backdrop-filter）与阴影堆砌。
- **Don't** 引入朱砂之外的第二强调色。
- **Don't** 用 emoji/unicode 字形充当控件图标；图标为单一细线描边的自绘 SVG。
