# Assetboard

一块本地的数字资产板：域名、服务器、仓库、订阅、数据库放在一屏里，到期和扣款一眼可见。macOS 原生 App，也能在浏览器里体验。

![主板](screenshots/board.png)

![全景](screenshots/panorama.png)

## 下载与安装

到 [Releases](https://github.com/hippone/assetboard/releases) 下载最新的 `Assetboard-macOS-arm64-*.zip`，解压后打开 `Assetboard.app`。仅提供 Apple Silicon 版本，需要 macOS 12 或更高。

## 使用

- **录入**：点 `+` 或按 `N` 手动添加；资产可记录到期 / 扣款日期、费用、账号、备注、管理链接和图标。服务器可填最多 4 个 IP。
- **导入**（`I`）：粘贴账单或续费通知文字，导入 CSV，拖入截图 / PDF / 邮件，或接入 GitHub、Cloudflare（只读令牌）和 Gmail（自备 Google OAuth 桌面客户端）。可选接入你自己的模型来识别截图和邮件。导入结果先预览，确认后才写入，可整批撤销。
- **关联**：把域名、仓库、服务和订阅账号挂在服务器上（`L`）。按 `P` 进入只读全景，一屏看每台服务器上挂着什么，拖动图块可改关联。全景显示的是登记状态，不探活。
- **整理**：拖动卡片排序或换区块，区块可收起、改成紧凑列表；`⌘Z` 撤销。
- **演示**：用 `--demo` 启动 App，或在浏览器打开 `?demo`，使用内置演示数据，不读写你的数据。

### 快捷键

| 键 | 作用 | 键 | 作用 |
|---|---|---|---|
| `⌘K` / `/` | 搜索 | `P` | 全景 |
| 方向键 | 移动焦点 | `L` | 关联 |
| `↩` | 详情 | `S` | 标记停用 |
| `I` / `N` / `E` | 导入 / 新建 / 编辑 | `H` / `F` | 隐藏 / 置前 |
| `O` / `⌘C` | 打开链接 / 复制 | `⌘Z` / `⇧⌘Z` | 撤销 / 重做 |
| `?` | 全部快捷键 | `esc` | 返回 |

## 从源码构建

需要 macOS 和 Xcode 命令行工具：

```sh
zsh desktop/build.sh    # 输出 dist/Assetboard.app，默认临时签名
node --test             # 单元测试
```

浏览器版：`python3 -m http.server 4317 --bind 127.0.0.1`，打开 <http://127.0.0.1:4317>。

## 隐私

数据只保存在本机（SQLite 和可读的 JSON 备份），不上传、不探测你的域名或 IP；令牌和 API key 存在 macOS 钥匙串，只在你主动触发时联网。

## 许可证

[MIT](LICENSE)
