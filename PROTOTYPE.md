# Assetboard 交互原型

最新界面：统一毛玻璃材质、窗口贴边、区块零间隙、无数量显示；功能保留在顶部和区块标题栏。Mac 窗口使用 NSVisualEffectView 原生毛玻璃背景。浏览器验证 main 内边距及区块间距均为 0，数量元素为 0，390px 无横向溢出；折叠与详情正常。

## Mac App（当前推荐）

打开 `dist/Assetboard.app`。这是本机 Apple Silicon 构建的原型，使用原生 macOS 窗口和内置 WebKit，无需网页服务器或安装 Node/Electron。可以将 App 移到自己的应用程序文件夹。

资产与布局保存到 `~/Library/Application Support/Assetboard/board.json`，每次保存前保留 `board.previous.json`。保存使用原子写入；无法读取原文件时停止加载，不用演示数据覆盖损坏文件。数据是本机明文 JSON，不上传到云端。

App 菜单“文件”支持导出 JSON 备份、打开数据文件夹，以及 Cloudflare 只读接入。内置资产仍是演示资料；新录入的资产可使用自定义图标和真实管理链接。Cloudflare 仅同步 DNS Zone 列表，API Token 经权限验证后保存在 macOS 钥匙串。此连接器尚未用真实账号完成端到端验证。

本机构建：`./desktop/build.sh`，使用临时签名。使用 Developer ID Application 证书构建并生成 ZIP：`SIGNING_IDENTITY='Developer ID Application: 名称 (TEAMID)' ./desktop/package.sh`。分发前仍需完成 Apple 公证；仅签名不会消除其他 Mac 上的 Gatekeeper 提示。

v0.1.0 发布包已于 2026-09-25 通过 Apple 公证（submission ID `56128736-3c05-405e-beeb-a1ca09202b43`）。票据已装订到 App，重新打包后从 ZIP 解压验证，Gatekeeper 返回 `Notarized Developer ID`。这些步骤只适用于该发布包；重新构建后需重新公证。

桌面验证（2026-09-24）：原生窗口成功打开；在界面收起域名区块后，读取本机 JSON 确认为收起；退出并重启 App 后，界面正确恢复收起状态。验证后恢复展开。存储测试通过新建、保存、重新读取、上一版备份和拒绝无效数据。

## 浏览器演示（保留）

本地打开： http://127.0.0.1:4317

启动：在本目录运行 `python3 -m http.server 4317 --bind 127.0.0.1`。

只保留资产大板与必要工具。内置记录是演示数据；用户可手动录入真实资产、上传图片图标，并填写可打开的管理链接。浏览器版不连接平台或创建外部资源。布局与资产修改保存在当前浏览器的 localStorage。

支持：类别区块、图形资产卡片、折叠摘要、搜索、详情、资料编辑、添加区块/资产、布局编辑、拖动排序、连续缩放、尺寸设置、撤销和类别完整视图。手机通过区块设置调整尺寸与顺序。

验证（2026-09-24）：桌面浏览器实测折叠与恢复、详情、搜索、拖动排序、缩放、撤销、添加与修改、刷新保留记录；390px 视口实测文档宽度 390px，无横向溢出。未进行真实设备测试或用户可用性研究。

已知原型边界：固定高度区块只显示完整卡片，其他资产通过查看全部进入；内置演示记录的链接不跳转；演示日期不代表实际账户；未实现后端和多设备同步。Cloudflare 连接器仅在 macOS App 中可用，只能发现 Zone，不提供注册到期或费用数据。
