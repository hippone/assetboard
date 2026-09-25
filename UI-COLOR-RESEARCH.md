# 色差、透明度与层级研究 · 2026-09-25

## 官方参考与本板判断

| 来源 | 可核实的规则/数值 | 本板采用方式 |
| --- | --- | --- |
| [Material Android 色彩角色](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md) | 浅色 Surface 98，Container Low 96、Container 94、High 92。是 Material tonal palette 的 tone，不是透明度或 HSL 百分比。 | 底色接近中性，用稳定明暗阶差区分结构；主色集中到操作。 |
| [Fluent 材质](https://fluent2.microsoft.design/material) | Mica 是轻微染色的不透明基底；Acrylic 用于可轻松关闭的临时浮层。没有全界面统一透明度配方。 | 保留用户要求的玻璃，但避免全部表面重复叠加浓染色与模糊。 |
| [Fluent 阴影](https://fluent2.microsoft.design/elevation) | 低层级浅色阴影示例为 14% opacity；Shadow 2/4 用于卡片，Shadow 8 用于更高的浮起表面。 | 4px 紧密布局用更弱的 3.5–7% 阴影，避免层层发脏；这是本板调整值。 |
| [Apple 材质](https://developer.apple.com/design/human-interface-guidelines/materials) | 材质根据平台、背景与辅助功能设置变化；不能用一个固定 alpha 复刻所有原生玻璃。 | 原生窗口材质延续；网页浅色配色与原生 Aqua 外观匹配，避免系统深色毛玻璃混入浅色 UI。 |
| [WCAG 文本对比](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 普通文字至少 4.5:1，大字至少 3:1；这是可读性阈值，不是相邻背景的美学比例。 | 在实际合成后的背景上计算文字对比，避免仅测原始色值。 |

## 本次实际参数（设计选择，不是上述系统的通用标准）

- 改用 OKLCH 感知明度控制，替代 HSL。不是 Material HCT 算法。
- 原始调色板 L：大板 0.925、类目 0.855、卡片 0.975；这些还会受透明叠加影响，不能当作最终屏幕亮度。
- 大面积色度限制 C：大板最高 0.008、类目 0.016、卡片 0.010；主色按钮最高 0.12。避免主色铺满整块背景。
- 类目不透明度 46%，卡片 70%，悬浮 80%；卡片仍为半透明，PNG 留白透明。
- 类目边缘深色 4.5%，上沿白色高光 18%；卡片白色边缘 24%，取消内层光晕。类目阴影 3.5%，卡片 5.5–6.5%。
- 默认雾蓝原始色：大板 #E3E6EB、类目 #CAD0D8、卡片 #F3F7FC、主文字 #1B1E23、次文字 #4F5358、主按钮 #385986。

## 验证

6 个预设与黑白红绿蓝 5 个极端输入，按 sRGB alpha 合成（大板底色、类目 46%、卡片 70%）计算：主文字/卡片最低 14.30:1，次文字/卡片 6.64:1，次文字/类目 5.48:1，白字/主按钮 6.78:1。只覆盖这些样本与所定义基底，不等于原生窗口在任意桌面背景下完整 WCAG 认证。

改动保留原色调选择与保存数据，统一更换生成算法及材质参数。
