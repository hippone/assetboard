# Assetboard

Assetboard 是一个本地数字资产大板原型，用来整理域名、服务器、订阅和数据库等资产。它提供原生 macOS 窗口，也可以直接在浏览器中体验。

![Assetboard 界面预览](prototype-refined-tones.png)

## 下载与运行

从 [v0.1.0 Release](https://github.com/hippone/assetboard/releases/tag/v0.1.0) 下载 `Assetboard-macOS-arm64-0.1.0.zip`，解压后打开 `Assetboard.app`。当前仅提供 Apple Silicon 版本，最低系统版本为 macOS 12。

v0.1.0 使用 Developer ID 签名，已通过 Apple 公证并装订票据。每个后续版本是否通过公证，以对应 Release 的说明为准。

## 当前支持

- 按类别查看资产，搜索、折叠区块和打开详情。
- 添加与编辑区块、资产，调整布局、拖动排序、缩放与撤销。
- 手动录入资产名称、平台、账号、用途、日期、费用、备注、管理链接和自定义 PNG/JPEG/WebP 图标（不超过 256 KB）。管理链接须为 HTTP(S)，由默认浏览器打开。
- macOS App 的“文件 → Cloudflare 只读接入…”支持使用限定 Zone Read 权限的 API Token 同步 DNS Zone 列表。令牌验证成功后保存在 macOS 钥匙串，可断开本机连接；断开不会撤销 Cloudflare 后台的令牌。
- macOS 版将资产和布局保存在 `~/Library/Application Support/Assetboard/board.json`，保存前保留 `board.previous.json`；“文件”菜单可导出 JSON 备份或打开数据文件夹。

应用内置的是**演示资产**，其管理按钮不会跳转。手动录入的资产可填写真实链接。Cloudflare 接入只读取 Zone 名称、账号和状态；Zone 不等于注册记录，不能由此推断域名到期日或账单。macOS 资产数据和自定义图标保存在本机明文 JSON 中，不上传到 Assetboard 服务；连接时只向 Cloudflare API 发送令牌并读取数据。浏览器版本支持手动录入，暂不支持平台同步。当前没有多设备同步或后端。请按需导出备份。

Cloudflare 令牌建议在平台后台新建，权限选择 **Zone → Zone → Read**，资源范围仅选需要同步的 Zone。App 仅请求 `GET /client/v4/zones`，同步前完成全部分页；权限失败或分页错误时不写入资产板。同步按 Zone ID 更新，保留本地备注、图标和管理链接；本次未返回的旧记录会标记出来，不会自动删除。要彻底撤销访问，需在 Cloudflare 后台删除该令牌。

## 从源码运行

在仓库根目录执行 `./desktop/build.sh`，输出位于 `dist/Assetboard.app`。这个命令默认使用本机临时签名。要使用自己的 Developer ID Application 证书生成 ZIP：

```sh
SIGNING_IDENTITY='Developer ID Application: Your Name (TEAMID)' ./desktop/package.sh
```

浏览器原型可通过 `python3 -m http.server 4317 --bind 127.0.0.1` 启动，然后访问 <http://127.0.0.1:4317>。浏览器版的修改保存在当前浏览器的 localStorage。

更多交互与验证记录见 [PROTOTYPE.md](PROTOTYPE.md)。
