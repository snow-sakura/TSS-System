# TSS AI测试平台 - 前端设计规范

## 设计方向

参考: TestRail/Qase的专业感 + Linear的现代感 + Polaroid暖白基调

## Token System

```
COLOR
  --ink #1C1917        (深棕黑 - 主文字)
  --paper #FFFBF5      (暖白纸 - 页面背景)
  --cream #FFF8ED       (奶油 - 卡片/侧边栏背景)
  --amber #D97706       (琥珀金 - 主品牌色)
  --amber-light #FEF3C7 (浅琥珀 - 背景高亮)
  --green #16A34A       (通过绿)
  --red #DC2626         (失败红)
  --blue #2563EB        (信息蓝)
  --muted #A8A29E       (灰棕 - 次要文字)
  --border #E7E5E4      (暖灰 - 边框)

TYPE
  display: 'Inter', system-ui - 标题/大数字
  body: 'Inter', system-ui - 正文 14px
  mono: 'JetBrains Mono', monospace - 代码/日志

LAYOUT
  登录: 左侧品牌展示(深色渐变+大标题) + 右侧表单(白色)
  Dashboard: 顶部统计条 + 模块网格卡片 + 最近活动
  详情页: 左侧导航 + 面包屑 + 工具栏 + 内容区

SIGNATURE
  每个模块卡片有独特的渐变色图标背景
  AI操作有闪光动效标识
  统计数字有大字体+小标签的设计
```
