# 本地 Gmail 导入

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)，为自己的项目启用 Gmail API，配置 OAuth 同意界面，再创建“桌面应用”OAuth 客户端，下载 JSON。Google 的[官方桌面快速入门](https://developers.google.com/workspace/gmail/api/quickstart/python)列出了这些步骤。
2. 在 macOS Assetboard 中打开“文件 → Gmail 账单与服务通知…”，选择下载的客户端 JSON。应用会打开 Google 授权网页，完成后浏览器返回本机 `127.0.0.1` 临时端口。
3. 应用只调用 Gmail 的读取接口，用搜索词 `invoice receipt billing renewal subscription payment 账单 续费 订阅 服务通知` 查找匹配邮件。匹配邮件的文字正文（有纯文本时优先，否则提取 HTML 可见文字）仅保存在本机 `assetboard.sqlite` 的 `evidence` 表，不自动生成资产；从“文件 → 查看导入资料…”核对。附件暂不下载。

Google 的 `gmail.readonly` 授权范围是整个邮箱只读；Assetboard 的搜索范围更窄。这个 scope 被 Google 列为受限权限，公开分发 OAuth 客户端可能需要验证。当前流程使用用户自己的桌面客户端 JSON，尚未用真实 Gmail 账号完成端到端验证。应用把 OAuth 客户端配置和刷新令牌分别保存在本机数据目录的 `gmail-client.json`、`gmail-oauth.json`，权限为当前用户可读写。撤销授权需到 Google 账号的第三方应用访问设置操作。

Gmail API 的 [`messages.list`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list) 支持搜索查询；[`messages.get`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get) 用于读取匹配邮件。图片/PDF 使用 macOS Vision/PDFKit 在本机识别，不调用远端 OCR 服务。
