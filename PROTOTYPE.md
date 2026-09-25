# Assetboard 交互原型

最新界面：统一毛玻璃材质、窗口贴边、区块零间隙、无数量显示；功能保留在顶部和区块标题栏。Mac 窗口使用 NSVisualEffectView 原生毛玻璃背景。浏览器验证 main 内边距及区块间距均为 0，数量元素为 0，390px 无横向溢出；折叠与详情正常。

## Mac App（当前推荐）

打开 `dist/Assetboard.app`。这是本机 Apple Silicon 构建的原型，使用原生 macOS 窗口和内置 WebKit，无需网页服务器或安装 Node/Electron。可以将 App 移到自己的应用程序文件夹。

资产与布局以 `~/Library/Application Support/Assetboard/assetboard.sqlite` 为准，同时维护 `board.json` 和 `board.previous.json` 镜像备份。旧 JSON 首次打开时迁入 SQLite；无法读取旧文件时停止加载，不用演示数据覆盖损坏文件。数据仅保存在本机，不上传到 Assetboard 服务。

App 菜单“文件”支持导出 JSON 备份、打开数据文件夹、Cloudflare/GitHub 只读接入、本机 OCR 和 Gmail 筛选导入。当前源码构建的资产板从空白开始；首次导入页可手动录入或选择平台及 OCR。升级时仅移除完全未修改的旧版演示记录和默认区块，保留自定义布局与编辑过的记录。新录入资产可使用自定义图标和真实管理链接。GitHub 已用本机 `gh` 真实读取 37 个授权范围内仓库；最近更新的 6 个展开，其余以图标和名称显示，可互换。Cloudflare 账号已同步 3 个 Zone；Pages 项目、Worker 脚本及 R2 Bucket 的发现逻辑通过模拟接口验证，当前本机记录中尚无这些资源。Gmail 尚未获得本机授权。OCR 用本机生成的样本图片通过了 Vision 识别测试。区块可拖动与拉伸，区块内卡片可拖动或用方向键排序。

本机构建：`./desktop/build.sh`，使用临时签名。使用 Developer ID Application 证书构建并生成 ZIP：`SIGNING_IDENTITY='Developer ID Application: 名称 (TEAMID)' ./desktop/package.sh`。分发前仍需完成 Apple 公证；仅签名不会消除其他 Mac 上的 Gatekeeper 提示。

v0.1.0 发布包已于 2026-09-25 通过 Apple 公证（submission ID `56128736-3c05-405e-beeb-a1ca09202b43`）。票据已装订到 App，重新打包后从 ZIP 解压验证，Gatekeeper 返回 `Notarized Developer ID`。这些步骤只适用于该发布包；重新构建后需重新公证。

桌面验证（2026-09-24）：原生窗口成功打开；在界面收起域名区块后，读取本机 JSON 确认为收起；退出并重启 App 后，界面正确恢复收起状态。验证后恢复展开。存储测试通过新建、保存、重新读取、上一版备份和拒绝无效数据。

## 浏览器演示（保留）

本地打开： http://127.0.0.1:4317

启动：在本目录运行 `python3 -m http.server 4317 --bind 127.0.0.1`。

只保留资产大板与必要工具。新浏览器数据从空白开始；用户可手动录入真实资产、上传图片图标，并填写可打开的管理链接。浏览器版不连接平台或创建外部资源。布局与资产修改保存在当前浏览器的 localStorage。

支持：类别区块、图形资产卡片、折叠摘要、搜索、详情、资料编辑、添加区块/资产、布局编辑、拖动排序、连续缩放、尺寸设置、撤销和类别完整视图。手机通过区块设置调整尺寸与顺序。

验证（2026-09-24）：桌面浏览器实测折叠与恢复、详情、搜索、拖动排序、缩放、撤销、添加与修改、刷新保留记录；390px 视口实测文档宽度 390px，无横向溢出。未进行真实设备测试或用户可用性研究。

已知原型边界：固定高度区块只显示完整卡片，其他资产通过查看全部进入；未实现后端和多设备同步。Cloudflare、GitHub、Gmail 和 OCR 仅在 macOS App 中可用。Cloudflare 与 GitHub 只发现授权范围内的资源列表元数据，不提供账单数据；Gmail 导入的匹配邮件与 OCR 文字先作为可核对资料保存，不自动创建资产。v0.1.0 已发布包仍包含当时的演示数据，本节新行为仅适用于当前源码构建。
