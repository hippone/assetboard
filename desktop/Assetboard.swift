import Cocoa
import WebKit
import Security
import CryptoKit
import UniformTypeIdentifiers

final class CloudflareConnector {
    private let service = "studio.assetboard.local.cloudflare"
    private let account = "zone-read-token"
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func token() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func saveToken(_ token: String) -> Bool {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let data = Data(token.utf8)
        if SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecSuccess { return true }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    func disconnect() -> Bool {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    func listZones(token: String, completion: @escaping ([[String: String]]?, String?) -> Void) {
        var all: [[String: String]] = []
        func page(_ number: Int) {
            var components = URLComponents(string: "https://api.cloudflare.com/client/v4/zones")!
            components.queryItems = [URLQueryItem(name: "page", value: String(number)), URLQueryItem(name: "per_page", value: "50")]
            var request = URLRequest(url: components.url!)
            request.httpMethod = "GET"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 20
            session.dataTask(with: request) { data, response, error in
                if error != nil { completion(nil, "网络请求失败，请检查连接后重试。"); return }
                guard let http = response as? HTTPURLResponse else { completion(nil, "未收到有效的平台响应。"); return }
                if http.statusCode == 401 || http.statusCode == 403 { completion(nil, "权限验证失败。请确认令牌具有 Zone Read 权限和正确的 Zone 范围。"); return }
                guard (200...299).contains(http.statusCode), let data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      json["success"] as? Bool == true,
                      let zones = json["result"] as? [[String: Any]],
                      let info = json["result_info"] as? [String: Any],
                      let totalPages = info["total_pages"] as? Int,
                      totalPages >= 0 && totalPages <= 100 && (totalPages >= number || (number == 1 && totalPages == 0 && zones.isEmpty)) else {
                    completion(nil, "Zone 列表响应不完整，同步未写入资产板。"); return
                }
                for zone in zones {
                    guard let id = zone["id"] as? String, !id.isEmpty,
                          let name = zone["name"] as? String, !name.isEmpty else {
                        completion(nil, "Zone 数据缺少标识或名称，同步未写入资产板。"); return
                    }
                    let account = (zone["account"] as? [String: Any])?["name"] as? String ?? ""
                    all.append(["id": id, "name": name, "account": account, "status": zone["status"] as? String ?? ""])
                }
                if number < totalPages { page(number + 1) }
                else { completion(all, nil) }
            }.resume()
        }
        page(1)
    }
}

final class GitHubConnector {
    private let service = "studio.assetboard.local.github"
    private let account = "metadata-read-token"
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func token() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func saveToken(_ token: String) -> Bool {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let data = Data(token.utf8)
        if SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecSuccess { return true }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    func disconnect() -> Bool {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    func listRepositories(token: String, completion: @escaping ([[String: Any]]?, String?) -> Void) {
        var all: [[String: Any]] = []
        func page(_ number: Int) {
            var components = URLComponents(string: "https://api.github.com/user/repos")!
            components.queryItems = [URLQueryItem(name: "per_page", value: "100"), URLQueryItem(name: "page", value: String(number)), URLQueryItem(name: "sort", value: "updated"), URLQueryItem(name: "direction", value: "desc")]
            var request = URLRequest(url: components.url!)
            request.httpMethod = "GET"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
            request.setValue("2026-03-10", forHTTPHeaderField: "X-GitHub-Api-Version")
            request.timeoutInterval = 20
            session.dataTask(with: request) { data, response, error in
                if error != nil { completion(nil, "网络请求失败，请检查连接后重试。"); return }
                guard let http = response as? HTTPURLResponse else { completion(nil, "未收到有效的平台响应。"); return }
                if http.statusCode == 401 { completion(nil, "GitHub 令牌无效或已过期。"); return }
                if http.statusCode == 403 { completion(nil, "GitHub 拒绝访问：检查仓库范围、组织审批或 API 限流。"); return }
                guard http.statusCode == 200, let data,
                      let repositories = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    completion(nil, "GitHub 仓库列表响应不完整，同步未写入资产板。"); return
                }
                for repository in repositories {
                    guard let id = repository["id"] as? Int, id > 0,
                          let name = repository["full_name"] as? String, !name.isEmpty,
                          let owner = (repository["owner"] as? [String: Any])?["login"] as? String,
                          let rawURL = repository["html_url"] as? String,
                          let url = URL(string: rawURL), url.scheme == "https", url.host == "github.com",
                          url.path == "/" + name, url.user == nil, url.password == nil,
                          url.query == nil, url.fragment == nil else {
                        completion(nil, "GitHub 仓库数据缺少标识、归属或有效链接，同步未写入资产板。"); return
                    }
                    all.append(["id": String(id), "name": name, "owner": owner, "url": rawURL,
                                "description": repository["description"] as? String ?? "",
                                "updatedAt": repository["updated_at"] as? String ?? "",
                                "private": repository["private"] as? Bool ?? false,
                                "archived": repository["archived"] as? Bool ?? false])
                }
                if repositories.count == 100 {
                    guard number < 100 else { completion(nil, "仓库列表超过当前分页上限，同步未写入资产板。"); return }
                    page(number + 1)
                } else { completion(all, nil) }
            }.resume()
        }
        page(1)
    }
}

// A local-only host. No HTTP server, remote renderer, or account is required.
final class BoardStore {
    let directory: URL
    let file: URL
    let database: LocalDatabase
    init(root: URL? = nil) throws {
        directory = root ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Assetboard", isDirectory: true)
        file = directory.appendingPathComponent("board.json")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        database = try LocalDatabase(file: directory.appendingPathComponent("assetboard.sqlite"))
    }
    func validate(_ value: Any) throws -> [String: Any] {
        let categories: Set<String> = ["bankcard", "phone", "server", "appleid", "google", "ai", "domain", "subscription", "database", "license", "repository", "deployment", "storage"]
        guard let board = value as? [String: Any],
              let blocks = board["blocks"] as? [[String: Any]],
              let assets = board["assets"] as? [[String: Any]],
              blocks.allSatisfy({ categories.contains($0["id"] as? String ?? "") }),
              assets.allSatisfy({ ($0["id"] as? String) != nil && ($0["name"] as? String) != nil && categories.contains($0["type"] as? String ?? "") }) else {
            throw NSError(domain: "Assetboard", code: 1, userInfo: [NSLocalizedDescriptionKey: "资产文件格式无法识别，原文件未被修改。"])
        }
        return board
    }
    func load() throws -> [String: Any]? {
        if let saved = try database.loadBoard() { return try validate(saved) }
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        let legacy = try validate(JSONSerialization.jsonObject(with: Data(contentsOf: file)))
        try database.saveBoard(legacy)
        return legacy
    }
    func save(_ value: Any) throws {
        let board = try validate(value)
        let bytes = try JSONSerialization.data(withJSONObject: board, options: [.prettyPrinted, .sortedKeys])
        try database.saveBoard(board)
        do {
            if FileManager.default.fileExists(atPath: file.path) {
                let previous = try Data(contentsOf: file)
                let backup = directory.appendingPathComponent("board.previous.json")
                try previous.write(to: backup, options: .atomic)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: backup.path)
            }
            try bytes.write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        } catch {
            // SQLite is the source of truth; a failed JSON mirror must not report a lost save.
            NSLog("Assetboard JSON mirror could not be updated: %@", error.localizedDescription)
        }
    }
}

/// `--demo`: the fictional board from demo-data.js, for screenshots. Uses a throwaway temporary store instead of
/// Application Support, never reads the Keychain and refuses network/Keychain imports, sync, AI, OCR and export. In-page CSV/JSON demo samples still run in JS without saving.
let demoMode = CommandLine.arguments.contains("--demo")

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate, NSToolbarDelegate, NSSearchFieldDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var store: BoardStore!
    var ai: AIRecognizer!
    let cloudflare = CloudflareConnector()
    let github = GitHubConnector()
    let icons = IconFetcher()
    var localRoot: URL!
    let searchField = NSSearchField(frame: NSRect(x: 0, y: 0, width: 200, height: 28))
    var inboxButton: NSButton!
    var connectionStateJSON: String?
    var boardLoaded = false

    func publishConnectionState() {
        guard boardLoaded, let connectionStateJSON else { return }
        webView.evaluateJavaScript("window.assetboardConnectionState?.(\(connectionStateJSON))")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        boardLoaded = true
        publishConnectionState()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            // `--demo --dark` / `--demo --light` pin the appearance for screenshots; otherwise the app follows the system.
            if demoMode, CommandLine.arguments.contains("--dark") { NSApp.appearance = NSAppearance(named: .darkAqua) }
            if demoMode, CommandLine.arguments.contains("--light") { NSApp.appearance = NSAppearance(named: .aqua) }
            let temporary = FileManager.default.temporaryDirectory
            if demoMode { // earlier demo runs that were killed never reached applicationWillTerminate
                for old in (try? FileManager.default.contentsOfDirectory(at: temporary, includingPropertiesForKeys: nil)) ?? [] where old.lastPathComponent.hasPrefix("assetboard-demo-") { try? FileManager.default.removeItem(at: old) }
            }
            let demoRoot = temporary.appendingPathComponent("assetboard-demo-" + UUID().uuidString, isDirectory: true)
            store = try demoMode ? BoardStore(root: demoRoot) : BoardStore()
            ai = AIRecognizer(directory: store.directory)
            let saved: [String: Any]? = demoMode ? nil : try store.load()
            guard let root = Bundle.main.resourceURL?.appendingPathComponent("Board", isDirectory: true) else { return }
            localRoot = root
            let controller = WKUserContentController()
            let initial: [String: Any] = ["data": saved as Any? ?? NSNull(), "cloudflareConnected": false, "githubConnected": false,
                                          "cloudflareChecking": true, "githubChecking": true,
                                          "gmailConfigured": !demoMode && FileManager.default.fileExists(atPath: store.directory.appendingPathComponent("gmail-client.json").path),
                                          "ai": demoMode ? NSNull() : ai.loadSettings()?.summary ?? NSNull(), "demo": demoMode]
            let json = String(data: try JSONSerialization.data(withJSONObject: initial), encoding: .utf8)!
            controller.addUserScript(WKUserScript(source: "window.__ASSETBOARD_NATIVE__ = \(json);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            controller.add(self, name: "assetboard")
            let configuration = WKWebViewConfiguration()
            configuration.userContentController = controller
            configuration.websiteDataStore = .nonPersistent()
            webView = WKWebView(frame: .zero, configuration: configuration)
            webView.navigationDelegate = self
            webView.setValue(false, forKey: "drawsBackground")
            window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
            window.title = demoMode ? "Assetboard（演示数据）" : "Assetboard"
            // No fixed appearance: the window, native glass and the page's prefers-color-scheme follow the system.
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.toolbarStyle = .unified
            window.titlebarSeparatorStyle = .none
            let toolbar = NSToolbar(identifier: "AssetboardToolbar")
            toolbar.delegate = self
            toolbar.displayMode = .iconOnly
            toolbar.allowsUserCustomization = false
            window.toolbar = toolbar
            window.isOpaque = false
            window.backgroundColor = NSColor(calibratedRed: 0.80, green: 0.85, blue: 0.82, alpha: 0.88)
            window.minSize = NSSize(width: 390, height: 500)
            let glass = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: 1320, height: 900))
            glass.material = .underWindowBackground
            glass.blendingMode = .behindWindow
            glass.state = .active
            // One continuous native glass surface extends behind the toolbar.
            // Content starts below the system controls, including in full screen.
            webView.translatesAutoresizingMaskIntoConstraints = false
            glass.addSubview(webView)
            window.contentView = glass
            let contentGuide = window.contentLayoutGuide as! NSLayoutGuide
            NSLayoutConstraint.activate([
                webView.topAnchor.constraint(equalTo: contentGuide.topAnchor),
                webView.leadingAnchor.constraint(equalTo: glass.leadingAnchor),
                webView.trailingAnchor.constraint(equalTo: glass.trailingAnchor),
                webView.bottomAnchor.constraint(equalTo: glass.bottomAnchor)
            ])
            window.delegate = self
            window.isReleasedWhenClosed = false
            window.setFrameAutosaveName("AssetboardMainWindow")
            if !window.setFrameUsingName("AssetboardMainWindow") { window.center() }
            createMenu()
            webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
            window.makeKeyAndOrderFront(nil)
            NSApplication.shared.activate(ignoringOtherApps: true)
            if demoMode {
                connectionStateJSON = "{\"cloudflareChecking\":false,\"githubChecking\":false,\"cloudflareConnected\":false,\"githubConnected\":false,\"aiKeySaved\":false}"
            } else { DispatchQueue.global(qos: .utility).async {
                let connections: [String: Any] = ["cloudflareConnected": self.cloudflare.token() != nil, "githubConnected": self.github.token() != nil,
                                                  "aiKeySaved": self.ai.key() != nil, "cloudflareChecking": false, "githubChecking": false]
                guard let bytes = try? JSONSerialization.data(withJSONObject: connections),
                      let json = String(data: bytes, encoding: .utf8) else { return }
                DispatchQueue.main.async { self.connectionStateJSON = json; self.publishConnectionState() }
            } }
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
                if self.connectionStateJSON == nil {
                    self.connectionStateJSON = "{\"cloudflareChecking\":false,\"githubChecking\":false,\"keychainUnavailable\":true}"
                    self.publishConnectionState()
                }
            }
        } catch {
            let alert = NSAlert()
            alert.messageText = "无法打开本地资产板"
            alert.informativeText = error.localizedDescription + "\n数据位于 ~/Library/Application Support/Assetboard/。请保留原文件。"
            alert.addButton(withTitle: "退出")
            alert.runModal()
            NSApplication.shared.terminate(nil)
        }
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, .init("search"), .init("inbox"), .init("theme"), .init("add")]
    }
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        let item = NSToolbarItem(itemIdentifier: id)
        switch id.rawValue {
        case "theme":
            let button = NSButton(title: "色调", target: self, action: #selector(openTheme))
            button.bezelStyle = .rounded
            item.label = "色调"
            item.view = button
        case "search":
            searchField.placeholderString = "搜索资产"
            searchField.delegate = self
            searchField.sendsSearchStringImmediately = true
            item.label = "搜索资产"
            item.view = searchField
        case "inbox":
            inboxButton = NSButton(title: "待确认", target: self, action: #selector(openInbox))
            inboxButton.bezelStyle = .rounded
            item.label = "待确认"
            item.view = inboxButton
        case "add":
            let button = NSButton(title: "添加区块", image: NSImage(systemSymbolName: "plus", accessibilityDescription: "添加区块")!, target: self, action: #selector(addBlock))
            button.bezelStyle = .rounded
            item.label = "添加区块"
            item.view = button
        default: return nil
        }
        return item
    }
    func controlTextDidChange(_ notification: Notification) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: [searchField.stringValue]),
              let value = String(data: bytes, encoding: .utf8) else { return }
        webView.evaluateJavaScript("document.querySelector('#search').value=\(value)[0];document.querySelector('#search').dispatchEvent(new Event('input'))")
    }
    @objc func addBlock() { webView.evaluateJavaScript("document.querySelector('#add-block').click()") }
    @objc func focusSearch() { window.makeFirstResponder(searchField) }
    @objc func showKeyboardHelp() { webView.evaluateJavaScript("toggleKeysHelp(true)") }
    @objc func openTheme() { webView.evaluateJavaScript("themeDialog()") }
    func demoBlocked() { webView.evaluateJavaScript("window.assetboardDemoBlocked?.()") }
    @objc func openCloudflare() { if demoMode { demoBlocked(); return }; webView.evaluateJavaScript("cloudflareDialog()") }
    @objc func openGitHub() { if demoMode { demoBlocked(); return }; webView.evaluateJavaScript("githubDialog()") }
    @objc func openGmail() { if demoMode { demoBlocked(); return }; webView.evaluateJavaScript("gmailDialog()") }
    @objc func openImport() { webView.evaluateJavaScript("importHub()") }
    @objc func openInbox() { webView.evaluateJavaScript("inboxDialog()") }
    @objc func openIconBatch() { if demoMode { demoBlocked(); return }; webView.evaluateJavaScript("iconBatchDialog()") }
    @objc func openAISettings() { if demoMode { demoBlocked(); return }; webView.evaluateJavaScript("aiDialog()") }
    func aiResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardAIResult(\(json))")
        }
    }
    func saveAISettings(_ body: [String: Any]) {
        let supplied = (body["apiKey"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard supplied.count <= 512, !supplied.contains(where: { $0.isWhitespace }) else { aiResult(["kind": "settings", "ok": false, "error": "API key 格式无效。"]); return }
        let settings: AISettings
        do {
            settings = try AIRecognizer.validate(provider: body["provider"] as? String ?? "", baseURL: body["baseURL"] as? String ?? "",
                                                 model: body["model"] as? String ?? "", autoImages: body["autoImages"] as? Bool ?? true)
        } catch { aiResult(["kind": "settings", "ok": false, "error": error.localizedDescription]); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let key = supplied.isEmpty ? self.ai.key() : supplied
            guard key != nil || AIRecognizer.isLocal(URL(string: settings.baseURL)!) else {
                self.aiResult(["kind": "settings", "ok": false, "error": "请填写 API key。"]); return
            }
            // A tiny request proves the endpoint, model and key work before anything is stored.
            self.ai.recognize(settings: settings, key: key, text: "连接测试：没有需要分析的材料，请只回复 {\"items\":[]}", image: nil) { result in
                if case .failure(let error) = result { self.aiResult(["kind": "settings", "ok": false, "error": error.localizedDescription]); return }
                do { try self.ai.saveSettings(settings) } catch { self.aiResult(["kind": "settings", "ok": false, "error": "无法保存 AI 设置：\(error.localizedDescription)"]); return }
                if !supplied.isEmpty && !self.ai.saveKey(supplied) {
                    self.aiResult(["kind": "settings", "ok": false, "error": "无法将 API key 保存到 macOS 钥匙串。"]); return
                }
                self.aiResult(["kind": "settings", "ok": true, "ai": settings.summary, "aiKeySaved": self.ai.key() != nil])
            }
        }
    }
    func recognizeWithAI(_ body: [String: Any]) {
        let requestId = body["requestId"] as? Int ?? 0
        let evidenceId = body["evidenceId"] as? String
        let pasted = String((body["text"] as? String ?? "").prefix(8000))
        DispatchQueue.global(qos: .userInitiated).async {
            func fail(_ message: String) { self.aiResult(["kind": "recognize", "requestId": requestId, "ok": false, "error": message]) }
            guard let settings = self.ai.loadSettings() else { fail("尚未配置 AI 识别。"); return }
            let key = self.ai.key()
            guard key != nil || AIRecognizer.isLocal(URL(string: settings.baseURL)!) else { fail("没有找到已保存的 API key，请在 AI 识别设置中重新填写。"); return }
            let today = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate])
            var text = "今天：\(today)\n"
            var image: Data?
            if let evidenceId {
                guard let row = try? self.store.database.evidence(id: evidenceId) else { fail("找不到这条导入资料。"); return }
                let payload = (try? JSONSerialization.jsonObject(with: Data((row["payload"] ?? "{}").utf8))) as? [String: Any] ?? [:]
                if row["kind"] == "gmail" {
                    text += "来源：Gmail 邮件\n发件人：\(row["source"] ?? "")\n主题：\(row["title"] ?? "")\n邮件日期：\(payload["date"] as? String ?? "")\n正文：\n\(row["body"] ?? "")"
                } else {
                    // Send the original screenshot only when it is still the same file that was imported.
                    if let path = payload["file"] as? String, let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
                       "ocr-" + SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == evidenceId {
                        image = AIRecognizer.preparedImage(at: URL(fileURLWithPath: path))
                    }
                    text += "来源：截图或 PDF（\(row["title"] ?? "")）\n" + (image != nil ? "请以附图为准；以下本机识别文字可能有误：\n" : "本机识别出的文字：\n") + String((row["body"] ?? "").prefix(image != nil ? 3000 : 8000))
                }
            } else {
                guard !pasted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { fail("没有可识别的文字。"); return }
                text += "来源：用户粘贴的文字\n\(pasted)"
            }
            self.ai.recognize(settings: settings, key: key, text: text, image: image) { result in
                switch result {
                case .failure(let error): fail(error.localizedDescription)
                case .success(let reply):
                    let reading: [String: Any] = ["provider": settings.provider, "model": settings.model, "at": ISO8601DateFormatter().string(from: Date()), "text": String(reply.prefix(20000)), "image": image != nil]
                    if let evidenceId {
                        do { try self.store.database.mergeEvidencePayload(id: evidenceId, values: ["ai": reading]) } catch { fail(error.localizedDescription); return }
                    }
                    self.aiResult(["kind": "recognize", "requestId": requestId, "ok": true, "evidenceId": evidenceId ?? NSNull(), "ai": reading])
                }
            }
        }
    }
    func gmailResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardGmailResult(\(json))")
        }
    }
    func syncGmail(configure: Bool = false) {
        let clientFile = store.directory.appendingPathComponent("gmail-client.json")
        if configure || !FileManager.default.fileExists(atPath: clientFile.path) {
            let panel = NSOpenPanel()
            panel.allowedContentTypes = [.json]
            panel.message = "选择桌面应用类型的 OAuth 客户端 JSON"
            panel.beginSheetModal(for: window) { response in
                guard response == .OK, let url = panel.url else {
                    self.gmailResult(["ok": false, "error": "尚未选择 OAuth 客户端 JSON。"])
                    return
                }
                do {
                    let data = try Data(contentsOf: url)
                    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                          let installed = root["installed"] as? [String: Any],
                          installed["client_id"] as? String != nil,
                          installed["client_secret"] as? String != nil else {
                        self.gmailResult(["ok": false, "error": "请选择 Google Cloud 中桌面应用类型的 OAuth 客户端 JSON。"])
                        return
                    }
                    try data.write(to: clientFile, options: .atomic)
                    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: clientFile.path)
                    self.runGmailImport(clientFile: clientFile)
                } catch { self.gmailResult(["ok": false, "error": "无法保存本机 OAuth 配置：\(error.localizedDescription)"]) }
            }
        } else { runGmailImport(clientFile: clientFile) }
    }
    func runGmailImport(clientFile: URL) {
        guard let script = Bundle.main.resourceURL?.appendingPathComponent("Board/gmail_local.py"),
              FileManager.default.fileExists(atPath: script.path) else {
            gmailResult(["ok": false, "error": "应用缺少 Gmail 本地同步脚本，请重新构建。"])
            return
        }
        let databaseFile = store.database.file
        let tokenFile = store.directory.appendingPathComponent("gmail-oauth.json")
        DispatchQueue.global(qos: .userInitiated).async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
            process.arguments = [script.path, "--credentials", clientFile.path, "--database", databaseFile.path, "--token-file", tokenFile.path]
            process.standardError = FileHandle.nullDevice
            let output = Pipe()
            process.standardOutput = output
            do { try process.run() } catch {
                self.gmailResult(["ok": false, "error": "无法启动本机 Gmail 同步。"])
                return
            }
            let bytes = output.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            guard bytes.count < 10000,
                  let result = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
                self.gmailResult(["ok": false, "error": "本机 Gmail 同步没有返回有效结果。"])
                return
            }
            self.gmailResult(result)
        }
    }
    @objc func importDocumentOCR() {
        if demoMode { demoBlocked(); return }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType.png, .jpeg, .pdf] + [UTType(filenameExtension: "webp")].compactMap { $0 }
        panel.allowsMultipleSelection = true
        panel.message = "选择截图或 PDF，文字只在此 Mac 识别"
        panel.beginSheetModal(for: window) { response in
            guard response == .OK else { return }
            let urls = panel.urls.prefix(10)
            guard !urls.isEmpty else { return }
            DispatchQueue.global(qos: .userInitiated).async {
                var last: [String: Any]?
                for url in urls {
                    do {
                        let text = try OCRImporter.recognize(at: url)
                        let digest = SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
                        DispatchQueue.main.async {
                            do {
                                try self.store.database.saveEvidence(id: "ocr-" + digest, kind: "ocr", source: url.lastPathComponent, title: url.lastPathComponent, body: text, payload: ["file": url.path])
                                self.ocrResult(["ok": true, "id": "ocr-" + digest, "title": url.lastPathComponent])
                            } catch { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
                        }
                        last = ["ok": true]
                    } catch {
                        DispatchQueue.main.async { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
                    }
                }
                _ = last
            }
        }
    }
    func importDroppedOCR(_ body: [String: Any]) {
        if demoMode { demoBlocked(); return }
        guard let name = body["name"] as? String, !name.isEmpty, name.count <= 200,
              let base64 = body["base64"] as? String, !base64.isEmpty, base64.count <= 36_000_000,
              let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= 25 * 1024 * 1024 else {
            ocrResult(["ok": false, "error": "无法读取拖入的文件。"])
            return
        }
        let ext = (name as NSString).pathExtension.lowercased()
        guard ["png", "jpg", "jpeg", "webp", "pdf"].contains(ext) else {
            ocrResult(["ok": false, "error": "请拖入 PNG、JPEG、WebP 图片或 PDF。"])
            return
        }
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent("assetboard-ocr-" + UUID().uuidString + "." + ext)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try data.write(to: temp, options: .atomic)
                defer { try? FileManager.default.removeItem(at: temp) }
                let text = try OCRImporter.recognize(at: temp)
                let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                DispatchQueue.main.async {
                    do {
                        try self.store.database.saveEvidence(id: "ocr-" + digest, kind: "ocr", source: name, title: name, body: text, payload: ["file": name])
                        self.ocrResult(["ok": true, "id": "ocr-" + digest, "title": name])
                    } catch { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
                }
            } catch {
                DispatchQueue.main.async { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
            }
        }
    }
    @objc func showImportedEvidence() { openInbox() }
    func sendEvidenceList() {
        do {
            let rows = try store.database.listEvidence()
            guard let data = try? JSONSerialization.data(withJSONObject: rows), let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.assetboardEvidenceList(\(json))")
        } catch {
            guard let data = try? JSONSerialization.data(withJSONObject: [error.localizedDescription]), let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.assetboardEvidenceList(null, \(json)[0])")
        }
    }
    func ocrResult(_ result: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.assetboardOCRResult(\(json))")
    }

    func cloudflareResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardCloudflareResult(\(json))")
        }
    }
    func githubResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardGitHubResult(\(json))")
        }
    }

    func syncGitHubWithLocalCLI(users: [String]? = nil) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let path = LocalCLI.ghPath() else {
                self.githubResult([
                    "ok": false,
                    "error": "未找到本机 GitHub CLI。",
                    "nextSteps": [
                        "安装：brew install gh && gh auth login",
                        "或使用预填的细粒度令牌页面创建只读令牌后粘贴。"
                    ],
                    "tokenUrl": "https://github.com/settings/tokens?type=beta"
                ])
                return
            }
            do {
                let accounts = try LocalCLI.ghAccounts(path: path)
                let selected: [String]
                if let users, !users.isEmpty {
                    selected = users.filter { accounts.contains($0) }
                    if selected.isEmpty {
                        self.githubResult(["ok": false, "error": "所选账号未在本机 gh 登录。已登录：\(accounts.joined(separator: ", "))"])
                        return
                    }
                } else {
                    selected = accounts.isEmpty ? [""] : accounts
                }
                var all: [[String: Any]] = []
                var warnings: [String] = []
                let group = DispatchGroup()
                let lock = NSLock()
                for user in selected {
                    group.enter()
                    do {
                        let token = try LocalCLI.ghToken(path: path, user: user.isEmpty ? nil : user)
                        self.github.listRepositories(token: token) { repositories, error in
                            defer { group.leave() }
                            if let error {
                                lock.lock(); warnings.append("\(user.isEmpty ? "当前账号" : user)：\(error)"); lock.unlock()
                                return
                            }
                            lock.lock(); all.append(contentsOf: repositories ?? []); lock.unlock()
                        }
                    } catch {
                        warnings.append(error.localizedDescription)
                        group.leave()
                    }
                }
                group.wait()
                // Dedupe by repo id
                var seen = Set<String>()
                var unique: [[String: Any]] = []
                for repo in all {
                    let id = String(describing: repo["id"] ?? "")
                    if id.isEmpty || seen.contains(id) { continue }
                    seen.insert(id)
                    unique.append(repo)
                }
                if unique.isEmpty {
                    self.githubResult([
                        "ok": false,
                        "error": warnings.joined(separator: "；").isEmpty ? "本机 gh 没有可读的仓库。" : warnings.joined(separator: "；"),
                        "nextSteps": ["运行 gh auth login 登录需要的账号", "或粘贴 GitHub 细粒度只读令牌"],
                        "tokenUrl": "https://github.com/settings/tokens?type=beta"
                    ])
                    return
                }
                self.githubResult(["ok": true, "repositories": unique, "connected": false, "accounts": selected.filter { !$0.isEmpty }, "warnings": warnings])
            } catch {
                self.githubResult([
                    "ok": false,
                    "error": error.localizedDescription,
                    "nextSteps": ["brew install gh && gh auth login", "或使用令牌同步"],
                    "tokenUrl": "https://github.com/settings/tokens?type=beta"
                ])
            }
        }
    }

    func importSshConfig() {
        if demoMode { demoBlocked(); return }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let text = try LocalCLI.readSshConfigText()
                self.sshResult(["ok": true, "text": text])
            } catch {
                self.sshResult(["ok": false, "error": error.localizedDescription, "nextSteps": ["在 ~/.ssh/config 中添加 Host 条目", "或手动录入服务器资产"]])
            }
        }
    }

    func sshResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardSshResult?.(\(json))")
        }
    }

    func publishLocalCliDetect() {
        let info = LocalCLI.detect()
        guard let data = try? JSONSerialization.data(withJSONObject: info),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.assetboardLocalCliDetect?.(\(json))")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(localRoot.standardizedFileURL.path + "/"),
              let body = message.body as? [String: Any] else { return }
        if body["action"] as? String == "themeColor" {
            if let rgb = body["rgb"] as? [Double], rgb.count == 3, rgb.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 255 }) {
                window.backgroundColor = NSColor(calibratedRed: rgb[0]/255, green: rgb[1]/255, blue: rgb[2]/255, alpha: 0.88)
            }
            return
        }
        // Demo mode answers saves as done without writing and refuses everything that would touch data, the Keychain or the network.
        if demoMode, let action = body["action"] as? String, !["toolbarState", "openExternal", "copyText", "focusSearch"].contains(action) {
            if action == "save", let sequence = body["sequence"] as? Int { webView.evaluateJavaScript("window.assetboardSaved?.(\(sequence), true)") }
            else if action == "evidenceList" { webView.evaluateJavaScript("window.assetboardEvidenceList?.([], null)") }
            else { demoBlocked() }
            return
        }
        if body["action"] as? String == "toolbarState" {
            let pending = body["pending"] as? Int ?? 0
            inboxButton?.title = pending > 0 ? "待确认 \(pending)" : "待确认"
            searchField.stringValue = body["query"] as? String ?? ""
            return
        }
        if body["action"] as? String == "focusSearch" { focusSearch(); return }
        if body["action"] as? String == "copyText" {
            if let text = body["text"] as? String, !text.isEmpty, text.count <= 4096 {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            }
            return
        }
        if body["action"] as? String == "openLocalDirectory" {
            let opened = (body["path"] as? String).flatMap(LocalDirectory.validated).map(LocalDirectory.open) ?? false
            webView.evaluateJavaScript("window.assetboardLocalResult?.(\(opened))")
            return
        }
        if body["action"] as? String == "openExternal" {
            if let raw = body["url"] as? String, let url = URL(string: raw),
               ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
               url.host != nil, url.user == nil, url.password == nil,
               url.host?.lowercased() != "example.com" {
                NSWorkspace.shared.open(url)
            }
            return
        }
        if body["action"] as? String == "cloudflareDisconnect" {
            if cloudflare.disconnect() { cloudflareResult(["ok": true, "disconnected": true]) }
            else { cloudflareResult(["ok": false, "error": "无法从 macOS 钥匙串删除令牌，请重试。"]) }
            return
        }
        if body["action"] as? String == "cloudflareSync" {
            let supplied = (body["token"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard supplied.isEmpty || (supplied.count <= 256 && !supplied.contains(where: { $0.isWhitespace })) else {
                cloudflareResult(["ok": false, "error": "令牌格式无效。"]) ; return
            }
            guard let token = supplied.isEmpty ? cloudflare.token() : supplied else {
                cloudflareResult(["ok": false, "error": "请填写只读 API 令牌。"]) ; return
            }
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    var inventory = try CloudflareInventory().discover(token: token)
                    if !supplied.isEmpty && !self.cloudflare.saveToken(supplied) {
                        self.cloudflareResult(["ok": false, "error": "无法将令牌保存到 macOS 钥匙串，同步未写入资产板。"])
                        return
                    }
                    inventory["ok"] = true
                    inventory["connected"] = true
                    self.cloudflareResult(inventory)
                } catch { self.cloudflareResult(["ok": false, "error": error.localizedDescription]) }
            }
            return
        }
        if body["action"] as? String == "githubDisconnect" {
            if github.disconnect() { githubResult(["ok": true, "disconnected": true]) }
            else { githubResult(["ok": false, "error": "无法从 macOS 钥匙串删除令牌，请重试。"]) }
            return
        }
        if body["action"] as? String == "githubSyncLocal" {
            let users = body["users"] as? [String]
            syncGitHubWithLocalCLI(users: users)
            return
        }
        if body["action"] as? String == "localCliDetect" {
            publishLocalCliDetect()
            return
        }
        if body["action"] as? String == "sshConfigImport" {
            importSshConfig()
            return
        }
        if body["action"] as? String == "aiSave" {
            saveAISettings(body)
            return
        }
        if body["action"] as? String == "aiDisconnect" {
            ai.removeSettings()
            if ai.deleteKey() { aiResult(["kind": "settings", "ok": true, "disconnected": true]) }
            else { aiResult(["kind": "settings", "ok": false, "error": "无法从 macOS 钥匙串删除 API key，请重试。"]) }
            return
        }
        if body["action"] as? String == "iconFetch" {
            let requestId = body["requestId"] as? Int ?? 0
            icons.fetch(input: String((body["host"] as? String ?? "").prefix(300))) { result in
                var reply: [String: Any] = ["requestId": requestId]
                switch result {
                case .success(let icon): reply.merge(["ok": true, "host": icon.host, "dataUrl": icon.dataURL]) { $1 }
                case .failure(let error): reply.merge(["ok": false, "error": error.localizedDescription]) { $1 }
                }
                DispatchQueue.main.async {
                    guard let data = try? JSONSerialization.data(withJSONObject: reply), let json = String(data: data, encoding: .utf8) else { return }
                    self.webView.evaluateJavaScript("window.assetboardIconResult(\(json))")
                }
            }
            return
        }
        if body["action"] as? String == "aiRecognize" {
            recognizeWithAI(body)
            return
        }
        if body["action"] as? String == "evidenceList" {
            sendEvidenceList()
            return
        }
        if body["action"] as? String == "ocrImport" {
            importDocumentOCR()
            return
        }
        if body["action"] as? String == "ocrImportData" {
            importDroppedOCR(body)
            return
        }
        if body["action"] as? String == "gmailSync" {
            syncGmail(configure: body["configure"] as? Bool == true)
            return
        }
        if body["action"] as? String == "githubSync" {
            let supplied = (body["token"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard supplied.isEmpty || (supplied.count <= 256 && !supplied.contains(where: { $0.isWhitespace })) else {
                githubResult(["ok": false, "error": "令牌格式无效。"]) ; return
            }
            guard let token = supplied.isEmpty ? github.token() : supplied else {
                githubResult(["ok": false, "error": "请填写 GitHub 细粒度只读令牌。"]) ; return
            }
            github.listRepositories(token: token) { repositories, error in
                if let error { self.githubResult(["ok": false, "error": error]); return }
                if !supplied.isEmpty && !self.github.saveToken(supplied) {
                    self.githubResult(["ok": false, "error": "无法将令牌保存到 macOS 钥匙串，同步未写入资产板。"]) ; return
                }
                self.githubResult(["ok": true, "repositories": repositories ?? [], "connected": true])
            }
            return
        }
        guard body["action"] as? String == "save", let sequence = body["sequence"] as? Int, let data = body["data"] else { return }
        do {
            try store.save(data)
            webView.evaluateJavaScript("window.assetboardSaved(\(sequence), true)")
        } catch {
            webView.evaluateJavaScript("window.assetboardSaved(\(sequence), false)")
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(localRoot.standardizedFileURL.path + "/") else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func createMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 Assetboard", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 Assetboard", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let fileItem = NSMenuItem()
        let fileMenu = NSMenu(title: "文件")
        let importItem = NSMenuItem(title: "导入…", action: #selector(openImport), keyEquivalent: "i")
        importItem.keyEquivalentModifierMask = [.command]
        importItem.target = self
        fileMenu.addItem(importItem)
        let exportItem = NSMenuItem(title: "导出资产备份…", action: #selector(exportBoard), keyEquivalent: "s")
        exportItem.keyEquivalentModifierMask = [.command, .shift]
        exportItem.target = self
        fileMenu.addItem(exportItem)
        let iconsItem = NSMenuItem(title: "获取网站图标…", action: #selector(openIconBatch), keyEquivalent: "")
        iconsItem.target = self
        fileMenu.addItem(iconsItem)
        let evidenceItem = NSMenuItem(title: "待确认…", action: #selector(showImportedEvidence), keyEquivalent: "")
        evidenceItem.target = self
        fileMenu.addItem(evidenceItem)
        let aiItem = NSMenuItem(title: "AI 识别设置…", action: #selector(openAISettings), keyEquivalent: "")
        aiItem.target = self
        fileMenu.addItem(aiItem)
        let folderItem = NSMenuItem(title: "打开本地数据文件夹", action: #selector(openDataFolder), keyEquivalent: "")
        folderItem.target = self
        fileMenu.addItem(folderItem)
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileItem.submenu = fileMenu
        menu.addItem(fileItem)
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        let searchItem = NSMenuItem(title: "搜索资产", action: #selector(focusSearch), keyEquivalent: "k")
        searchItem.target = self
        editMenu.addItem(searchItem)
        for (title, action, key) in [("撤销", "undo:", "z"), ("重做", "redo:", "Z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editMenu.addItem(.separator())
        let keysItem = NSMenuItem(title: "键盘快捷键", action: #selector(showKeyboardHelp), keyEquivalent: "")
        keysItem.target = self
        editMenu.addItem(keysItem)
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApplication.shared.mainMenu = menu
    }

    @objc func openDataFolder() { if demoMode { demoBlocked(); return }; NSWorkspace.shared.open(store.directory) }
    @objc func exportBoard() {
        if demoMode { demoBlocked(); return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "Assetboard-backup.json"
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let destination = panel.url else { return }
            do {
                guard let board = try self.store.load() else { return }
                let data = try JSONSerialization.data(withJSONObject: board, options: [.prettyPrinted, .sortedKeys])
                try data.write(to: destination, options: .atomic)
            } catch {
                let alert = NSAlert(error: error)
                alert.beginSheetModal(for: self.window)
            }
        }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window?.makeKeyAndOrderFront(nil)
        return true
    }
    func applicationWillTerminate(_ notification: Notification) {
        if demoMode, let directory = store?.directory, directory.path.hasPrefix(FileManager.default.temporaryDirectory.path) { try? FileManager.default.removeItem(at: directory) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { return false }
}

final class MockCloudflareProtocol: URLProtocol {
    static var reply: ((URLRequest) -> (Int, Any))!
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, body) = Self.reply(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: try! JSONSerialization.data(withJSONObject: body))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class MockIconProtocol: URLProtocol {
    static var reply: ((URLRequest) -> (Int, Data))!
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, body) = Self.reply(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

// Host validation, icon link ranking, fallbacks and PNG normalisation, with HTTP stubbed.
// "Open in local editor": only an existing local folder, never a file, URL or path with "..".
enum LocalDirectory {
    static let editors = ["com.todesktop.230313mzl4w4u92", "com.microsoft.VSCode", "dev.zed.Zed"]
    static func validated(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 1000, !trimmed.contains("\0"),
              trimmed.hasPrefix("/") || trimmed.hasPrefix("~/"),
              !trimmed.split(separator: "/").contains("..") else { return nil }
        let url = URL(fileURLWithPath: (trimmed as NSString).expandingTildeInPath).standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue,
              !url.pathExtension.lowercased().hasSuffix("app") else { return nil }
        return url
    }
    static func open(_ url: URL) -> Bool {
        if let editor = editors.lazy.compactMap({ NSWorkspace.shared.urlForApplication(withBundleIdentifier: $0) }).first {
            NSWorkspace.shared.open([url], withApplicationAt: editor, configuration: NSWorkspace.OpenConfiguration())
            return true
        }
        return NSWorkspace.shared.open(url)
    }
}

func testLocalDirectory() {
    let temp = FileManager.default.temporaryDirectory.appendingPathComponent("assetboard-local-" + UUID().uuidString)
    try! FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temp) }
    let file = temp.appendingPathComponent("note.txt")
    try! Data("x".utf8).write(to: file)
    precondition(LocalDirectory.validated(temp.path)?.path == temp.resolvingSymlinksInPath().path, "Existing folder must be accepted")
    precondition(LocalDirectory.validated("~/")?.path == FileManager.default.homeDirectoryForCurrentUser.resolvingSymlinksInPath().path, "Home shorthand must expand")
    for refused in [file.path, temp.path + "/missing", "relative/path", "https://example.com", temp.path + "/../" + temp.lastPathComponent, "", "/Applications/Safari.app"] {
        precondition(LocalDirectory.validated(refused) == nil, "Path must be refused: \(refused)")
    }
    print("PASS: local folder validation")
}

func testIcons() {
    precondition(IconFetcher.host(from: " Wise.com ") == "wise.com")
    precondition(IconFetcher.host(from: "https://www.hsbc.com.hk/zh-hk/") == "www.hsbc.com.hk")
    for refused in ["192.168.1.1", "localhost", "printer.local", "https://user:pw@wise.com", "[::1]", "wise", "file:///etc", "-bad-.com"] {
        precondition(IconFetcher.host(from: refused) == nil, "Host must be refused: \(refused)")
    }
    let html = "<head><link rel=\"icon\" href=\"/favicon-32.png\" sizes=\"32x32\"><link rel='apple-touch-icon' href='touch.png'><link rel=\"mask-icon\" href=\"/mask.svg\"><link rel=\"icon\" href=\"http://wise.com/plain.png\"></head>"
    let ranked = IconFetcher.candidates(html: html, base: URL(string: "https://wise.com/en/")!).map(\.absoluteString)
    precondition(ranked == ["https://wise.com/en/touch.png", "https://wise.com/favicon-32.png", "https://wise.com/apple-touch-icon.png", "https://wise.com/favicon.ico"], ranked.description)
    let image = NSImage(size: NSSize(width: 64, height: 32))
    image.lockFocus(); NSColor.systemTeal.setFill(); NSRect(x: 0, y: 0, width: 64, height: 32).fill(); image.unlockFocus()
    let png = NSBitmapImageRep(data: image.tiffRepresentation!)!.representation(using: .png, properties: [:])!
    precondition(IconFetcher.normalized(Data("<html>".utf8)) == nil, "Non-images must be refused")
    let defaults = IconFetcher().session.configuration
    precondition(!defaults.httpShouldSetCookies && defaults.httpCookieAcceptPolicy == .never, "Icon requests must not send or keep cookies")
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockIconProtocol.self]
    let fetcher = IconFetcher(session: URLSession(configuration: configuration))
    var requested: [String] = []
    func run(_ input: String, _ reply: @escaping (URLRequest) -> (Int, Data)) -> Result<(host: String, dataURL: String), NSError> {
        requested = []
        MockIconProtocol.reply = { request in requested.append("\(request.httpMethod ?? "") \(request.url!.absoluteString)"); return reply(request) }
        let done = DispatchSemaphore(value: 0)
        var result: Result<(host: String, dataURL: String), NSError>!
        fetcher.fetch(input: input) { result = $0; done.signal() }
        precondition(done.wait(timeout: .now() + 5) == .success)
        return result
    }
    let found = run("wise.com") { request in
        switch request.url!.path {
        case "/": return (200, Data("<link rel=\"icon\" href=\"/missing.png\">".utf8))
        case "/apple-touch-icon.png": return (200, png)
        default: return (404, Data())
        }
    }
    guard case .success(let icon) = found, icon.host == "wise.com", icon.dataURL.hasPrefix("data:image/png;base64,"),
          let decoded = Data(base64Encoded: String(icon.dataURL.dropFirst("data:image/png;base64,".count))),
          let bitmap = NSBitmapImageRep(data: decoded), bitmap.pixelsWide == 128, bitmap.pixelsHigh == 128 else { fatalError("Fallback icon must be normalised: \(found)") }
    precondition(requested == ["GET https://wise.com/", "GET https://wise.com/missing.png", "GET https://wise.com/apple-touch-icon.png"], requested.description)
    guard case .failure(let missing) = run("empty.example") { _ in (404, Data()) }, missing.localizedDescription.contains("没有在 empty.example 找到") else { fatalError("A site without icons must say so") }
    guard case .failure(let refused) = run("127.0.0.1") { _ in (200, png) }, requested.isEmpty, refused.localizedDescription.contains("域名") else { fatalError("Refused hosts must not be contacted") }
    print("PASS: icon host validation, link ranking and fallbacks, GET-only fetch, no cookies, PNG normalisation, missing icon and refused host")
}

func testCloudflare() {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockCloudflareProtocol.self]
    let connector = CloudflareConnector(session: URLSession(configuration: configuration))
    func run(_ reply: @escaping (URLRequest) -> (Int, Any)) -> ([[String: String]]?, String?) {
        MockCloudflareProtocol.reply = reply
        let done = DispatchSemaphore(value: 0)
        var result: ([[String: String]]?, String?) = (nil, nil)
        connector.listZones(token: "test-token") { zones, error in result = (zones, error); done.signal() }
        precondition(done.wait(timeout: .now() + 5) == .success)
        return result
    }
    let success = run { request in
        precondition(request.httpMethod == "GET")
        precondition(request.url?.host == "api.cloudflare.com")
        precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
        let page = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!.first { $0.name == "page" }!.value!
        return (200, ["success": true, "result_info": ["total_pages": 2], "result": [["id": page, "name": "zone-\(page).dev", "account": ["name": "account"], "status": "active"]]])
    }
    precondition(success.1 == nil && success.0?.map { $0["id"]! } == ["1", "2"])
    let denied = run { _ in (403, ["success": false]) }
    precondition(denied.0 == nil && denied.1?.contains("权限验证失败") == true)
    let partial = run { request in
        let page = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!.first { $0.name == "page" }!.value!
        return page == "1" ? (200, ["success": true, "result_info": ["total_pages": 2], "result": [["id": "first", "name": "first.dev"]]]) : (200, ["success": true, "result_info": ["total_pages": 2], "result": [["name": "missing-id.dev"]]])
    }
    precondition(partial.0 == nil && partial.1 != nil)
    let empty = run { _ in (200, ["success": true, "result_info": ["total_pages": 0], "result": []]) }
    precondition(empty.0?.isEmpty == true && empty.1 == nil)
    print("PASS: Cloudflare GET-only auth header, pagination, denial, partial response, empty result")
}

func testGitHub() {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockCloudflareProtocol.self]
    let connector = GitHubConnector(session: URLSession(configuration: configuration))
    func run(_ reply: @escaping (URLRequest) -> (Int, Any)) -> ([[String: Any]]?, String?) {
        MockCloudflareProtocol.reply = reply
        let done = DispatchSemaphore(value: 0)
        var result: ([[String: Any]]?, String?) = (nil, nil)
        connector.listRepositories(token: "test-token") { repositories, error in result = (repositories, error); done.signal() }
        precondition(done.wait(timeout: .now() + 5) == .success)
        return result
    }
    func repository(_ id: Int) -> [String: Any] {
        ["id": id, "full_name": "owner/repo-\(id)", "owner": ["login": "owner"],
         "html_url": "https://github.com/owner/repo-\(id)", "private": true, "archived": false]
    }
    let success = run { request in
        precondition(request.httpMethod == "GET" && request.url?.host == "api.github.com" && request.url?.path == "/user/repos")
        precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
        precondition(request.value(forHTTPHeaderField: "Accept") == "application/vnd.github+json")
        let page = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!.first { $0.name == "page" }!.value!
        return (200, page == "1" ? (1...100).map(repository) : [repository(101)])
    }
    precondition(success.1 == nil && success.0?.count == 101 && success.0?.last?["id"] as? String == "101")
    let denied = run { _ in (403, ["message": "Resource not accessible by personal access token"]) }
    precondition(denied.0 == nil && denied.1?.contains("GitHub 拒绝访问") == true)
    let malformed = run { _ in (200, [["id": 1, "full_name": "owner/repo", "owner": ["login": "owner"], "html_url": "https://evil.example/repo"]]) }
    precondition(malformed.0 == nil && malformed.1 != nil)
    let partial = run { request in
        let page = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!.first { $0.name == "page" }!.value!
        return page == "1" ? (200, (1...100).map(repository)) : (200, [["id": 101, "full_name": "owner/broken"]])
    }
    precondition(partial.0 == nil && partial.1 != nil)
    let empty = run { _ in (200, [[String: Any]]()) }
    precondition(empty.0?.isEmpty == true && empty.1 == nil)
    print("PASS: GitHub GET-only auth header, pagination, denial, invalid URL, partial response, empty result")
}

func testCloudflareInventory() {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockCloudflareProtocol.self]
    let inventory = CloudflareInventory(session: URLSession(configuration: configuration))
    let accountId = String(repeating: "a", count: 32)
    MockCloudflareProtocol.reply = { request in
        precondition(request.httpMethod == "GET")
        precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
        switch request.url!.path {
        case "/client/v4/zones":
            return (200, ["success": true, "result": [["id": "zone-1", "name": "example.org", "status": "active"]], "result_info": ["total_pages": 1]])
        case "/client/v4/accounts":
            return (200, ["success": true, "result": [["id": accountId, "name": "My account"]], "result_info": ["total_pages": 1]])
        case "/client/v4/accounts/\(accountId)/pages/projects":
            return (200, ["success": true, "result": [["name": "my-pages"]], "result_info": ["total_pages": 1]])
        case "/client/v4/accounts/\(accountId)/workers/scripts":
            return (200, ["success": true, "result": [["id": "my-worker"]]])
        case "/client/v4/accounts/\(accountId)/r2/buckets":
            return (200, ["success": true, "result": ["buckets": [["name": "my-bucket"]]], "result_info": [:]])
        case "/client/v4/accounts/\(accountId)/registrar/registrations":
            return (200, ["success": true, "result": [["domain_name": "example.org", "expires_at": "2027-01-01T00:00:00Z", "status": "active", "auto_renew": true]], "result_info": [:]])
        default: fatalError("Unexpected Cloudflare endpoint \(request.url!.path)")
        }
    }
    do {
        let result = try inventory.discover(token: "test-token")
        precondition((result["resources"] as? [[String: String]])?.count == 5)
        precondition(Set(result["queriedKinds"] as? [String] ?? []) == Set(["zone", "pages", "worker", "r2", "registrar"]))
        MockCloudflareProtocol.reply = { request in
            request.url!.path == "/client/v4/zones"
                ? (200, ["success": true, "result": [], "result_info": ["total_pages": 1]])
                : (403, ["success": false])
        }
        let partial = try inventory.discover(token: "test-token")
        precondition((partial["queriedKinds"] as? [String]) == ["zone"])
        precondition(!(partial["warnings"] as? [String] ?? []).isEmpty)
        print("PASS: Cloudflare Zone, Pages, Workers, R2 discovery and partial permission handling")
    } catch { fputs("Cloudflare inventory test failed: \(error)\n", stderr); exit(1) }
}

func mockRequestBody(_ request: URLRequest) -> [String: Any] {
    var data = request.httpBody ?? Data()
    if data.isEmpty, let stream = request.httpBodyStream {
        stream.open()
        defer { stream.close() }
        var buffer = [UInt8](repeating: 0, count: 65536)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
    }
    return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
}

func testAI() {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    do {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        precondition((try? AIRecognizer.validate(provider: "openai", baseURL: "http://api.example.org/v1", model: "m", autoImages: true)) == nil, "Remote http must be rejected")
        precondition((try? AIRecognizer.validate(provider: "openai", baseURL: "https://user:secret@api.example.org/v1", model: "m", autoImages: true)) == nil, "Credentials in URL must be rejected")
        precondition((try? AIRecognizer.validate(provider: "other", baseURL: "https://api.example.org", model: "m", autoImages: true)) == nil)
        precondition((try? AIRecognizer.validate(provider: "anthropic", baseURL: "https://api.anthropic.com", model: " ", autoImages: true)) == nil)
        let local = try AIRecognizer.validate(provider: "openai", baseURL: " http://127.0.0.1:11434/v1 ", model: "qwen2.5vl:7b", autoImages: false)
        precondition(local.baseURL == "http://127.0.0.1:11434/v1" && AIRecognizer.isLocal(URL(string: local.baseURL)!))
        func endpoint(_ provider: String, _ base: String) -> String { AIRecognizer.endpoint(for: AISettings(provider: provider, baseURL: base, model: "m", autoImages: true))!.absoluteString }
        precondition(endpoint("anthropic", "https://api.anthropic.com") == "https://api.anthropic.com/v1/messages")
        precondition(endpoint("anthropic", "https://api.anthropic.com/v1/") == "https://api.anthropic.com/v1/messages")
        precondition(endpoint("openai", "https://api.openai.com/v1") == "https://api.openai.com/v1/chat/completions")
        precondition(endpoint("openai", "https://gateway.example.org/v1/chat/completions") == "https://gateway.example.org/v1/chat/completions")

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockCloudflareProtocol.self]
        let recognizer = AIRecognizer(directory: root, session: URLSession(configuration: configuration))
        func run(_ settings: AISettings, key: String?, image: Data?, _ reply: @escaping (URLRequest) -> (Int, Any)) -> Result<String, Error> {
            MockCloudflareProtocol.reply = reply
            let done = DispatchSemaphore(value: 0)
            var outcome: Result<String, Error>!
            recognizer.recognize(settings: settings, key: key, text: "材料", image: image) { outcome = $0; done.signal() }
            precondition(done.wait(timeout: .now() + 5) == .success)
            return outcome
        }
        let anthropic = AISettings(provider: "anthropic", baseURL: "https://api.anthropic.com", model: "claude-opus-5-5", autoImages: true)
        let claude = run(anthropic, key: "sk-test", image: Data([1, 2, 3])) { request in
            let body = mockRequestBody(request), content = ((body["messages"] as? [[String: Any]])?.first?["content"]) as? [[String: Any]] ?? []
            precondition(request.httpMethod == "POST" && request.url?.absoluteString == "https://api.anthropic.com/v1/messages")
            precondition(request.value(forHTTPHeaderField: "x-api-key") == "sk-test" && request.value(forHTTPHeaderField: "anthropic-version") == "2023-06-01")
            precondition(request.value(forHTTPHeaderField: "Authorization") == nil)
            precondition(body["model"] as? String == "claude-opus-5-5" && body["system"] as? String == AIRecognizer.prompt && body["max_tokens"] as? Int == 2000)
            precondition(content.first?["type"] as? String == "image" && ((content.first?["source"] as? [String: Any])?["data"] as? String) == "AQID")
            precondition(content.last?["text"] as? String == "材料")
            return (200, ["content": [["type": "text", "text": "{\"items\":[]}"]]])
        }
        guard case .success(let claudeReply) = claude, claudeReply == "{\"items\":[]}" else { fatalError("Anthropic reply not read") }
        let compatible = AISettings(provider: "openai", baseURL: "https://api.example.org/v1", model: "vision-model", autoImages: true)
        let openai = run(compatible, key: "key-1", image: Data([1, 2, 3])) { request in
            let body = mockRequestBody(request), messages = body["messages"] as? [[String: Any]] ?? []
            let user = messages.last?["content"] as? [[String: Any]] ?? []
            precondition(request.url?.absoluteString == "https://api.example.org/v1/chat/completions" && request.value(forHTTPHeaderField: "Authorization") == "Bearer key-1")
            precondition(messages.first?["role"] as? String == "system" && messages.first?["content"] as? String == AIRecognizer.prompt)
            precondition(((user.last?["image_url"] as? [String: Any])?["url"] as? String) == "data:image/jpeg;base64,AQID")
            return (200, ["choices": [["message": ["content": "ok"]]]])
        }
        guard case .success("ok") = openai else { fatalError("Compatible reply not read") }
        let textOnly = run(local, key: nil, image: nil) { request in
            let messages = mockRequestBody(request)["messages"] as? [[String: Any]] ?? []
            precondition(request.value(forHTTPHeaderField: "Authorization") == nil && messages.last?["content"] as? String == "材料")
            return (200, ["choices": [["message": ["content": [["type": "text", "text": "part"]]]]]])
        }
        guard case .success("part") = textOnly else { fatalError("Text-only request failed") }
        let denied = run(anthropic, key: "bad", image: nil) { _ in (401, ["type": "error", "error": ["type": "authentication_error", "message": "invalid x-api-key"]]) }
        guard case .failure(let error) = denied, error.localizedDescription.contains("API key 无效"), error.localizedDescription.contains("invalid x-api-key") else { fatalError("401 not explained") }
        let missing = run(compatible, key: "k", image: nil) { _ in (404, ["error": ["message": "model not found"]]) }
        guard case .failure(let notFound) = missing, notFound.localizedDescription.contains("模型不存在") else { fatalError("404 not explained") }
        let odd = run(compatible, key: "k", image: nil) { _ in (200, ["unexpected": true]) }
        guard case .failure = odd else { fatalError("Unexpected reply accepted") }

        try recognizer.saveSettings(anthropic)
        precondition(recognizer.loadSettings() == anthropic)
        let permissions = try FileManager.default.attributesOfItem(atPath: recognizer.settingsFile.path)[.posixPermissions] as? Int
        precondition(permissions == 0o600)
        try Data("{\"provider\":\"anthropic\",\"baseURL\":\"http://evil.example\",\"model\":\"m\",\"autoImages\":true}".utf8).write(to: recognizer.settingsFile)
        precondition(recognizer.loadSettings() == nil, "Tampered settings must not load")

        let wide = NSImage(size: NSSize(width: 3200, height: 800))
        wide.lockFocus(); NSColor.systemBlue.setFill(); NSRect(x: 0, y: 0, width: 3200, height: 800).fill(); wide.unlockFocus()
        let imageURL = root.appendingPathComponent("wide.png")
        try NSBitmapImageRep(data: wide.tiffRepresentation!)!.representation(using: .png, properties: [:])!.write(to: imageURL)
        guard let prepared = AIRecognizer.preparedImage(at: imageURL), let rep = NSBitmapImageRep(data: prepared) else { fatalError("Image not prepared") }
        precondition(rep.pixelsWide == 1600 && rep.pixelsHigh == 400)

        let store = try BoardStore(root: root.appendingPathComponent("store"))
        try store.database.saveEvidence(id: "ocr-x", kind: "ocr", source: "x.png", title: "x.png", body: "text", payload: ["file": "/tmp/x.png"])
        try store.database.mergeEvidencePayload(id: "ocr-x", values: ["ai": ["text": "{}"]])
        try store.database.saveEvidence(id: "ocr-x", kind: "ocr", source: "x.png", title: "x.png", body: "text", payload: ["file": "/tmp/y.png"])
        let row = try store.database.evidence(id: "ocr-x")
        let payload = (try? JSONSerialization.jsonObject(with: Data((row?["payload"] ?? "").utf8))) as? [String: Any]
        precondition(payload?["ai"] != nil && payload?["file"] as? String == "/tmp/y.png", "Re-import must keep the AI reading")
        print("PASS: AI settings validation, endpoints, Anthropic and compatible requests with images, error messages, settings file, image downscale, evidence annotation")
    } catch { fputs("AI test failed: \(error)\n", stderr); exit(1) }
}

final class WebViewTestHandler: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var actions: [String] = []
    var loaded = false
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let action = (message.body as? [String: Any])?["action"] as? String { actions.append(action) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded = true }
}

// Runs the bundled board in WebKit/JavaScriptCore: the in-page confirmation, undo and evidence bridge.
func testWebView() {
    _ = NSApplication.shared
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    // Optimised builds drop precondition messages, so failures print their reason before exiting.
    func check(_ ok: Bool, _ message: @autoclosure () -> String) { if !ok { fputs("WebView test failed: \(message())\n", stderr); exit(1) } }
    func wait(_ label: String = "condition", _ condition: () -> Bool) {
        let deadline = Date().addingTimeInterval(10)
        while !condition() && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
        check(condition(), "timed out waiting for \(label)")
    }
    do {
        guard let board = Bundle.main.resourceURL?.appendingPathComponent("Board", isDirectory: true) else { fatalError("Missing Board resources") }
        let store = try BoardStore(root: root)
        try store.database.saveEvidence(id: "gmail-a", kind: "gmail", source: "Figma <billing@figma.com>", title: "Your plan renews", body: "Your Figma plan will renew on October 6, 2099.\nYou will be charged $15.00/month.", payload: ["date": "Mon, 21 Sep 2026 10:00:00 +0000"])
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let soon = formatter.string(from: Date().addingTimeInterval(3 * 86400))
        let data: [String: Any] = ["blocks": [["id": "domain", "width": 50, "collapsed": false, "height": NSNull()]],
                                   "assets": [["id": "a", "type": "domain", "name": "soon.dev", "provider": "Registrar", "account": "", "date": soon, "art": "generic", "source": "manual"]]]
        let initial = String(data: try JSONSerialization.data(withJSONObject: ["data": data, "cloudflareConnected": false, "githubConnected": false, "gmailConfigured": false]), encoding: .utf8)!
        let handler = WebViewTestHandler()
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(source: "window.__errors=[];addEventListener('error',e=>__errors.push(e.message));window.__ASSETBOARD_NATIVE__ = \(initial);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(handler, name: "assetboard")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1200, height: 800), configuration: configuration)
        webView.navigationDelegate = handler
        webView.loadFileURL(board.appendingPathComponent("index.html"), allowingReadAccessTo: board)
        wait { handler.loaded && handler.actions.contains("evidenceList") }
        func run(_ script: String) -> String {
            var result: String?
            webView.evaluateJavaScript(script) { value, error in result = error.map { "ERROR: \($0)" } ?? (value as? String ?? "") }
            wait { result != nil }
            return result!
        }
        let rows = String(data: try JSONSerialization.data(withJSONObject: try store.database.listEvidence()), encoding: .utf8)!
        _ = run("window.assetboardEvidenceList(\(rows));''")
        let evidence = run("JSON.stringify({pending:pendingCount(),date:candidates()[0]?.date?.value,cost:candidates()[0]?.cost,agenda:document.querySelector('#agenda').innerText})")
        precondition(evidence.contains("\"pending\":1") && evidence.contains("2099-10-06") && evidence.contains("$15.00 / 月") && evidence.contains("3 天后到期"), evidence)
        let opened = run("document.querySelector('[data-asset=\"a\"] .card-open').click();document.querySelector('#detail [data-action=\"delete-asset\"]').click();String(!!document.querySelector('#modal[open] #confirm-yes'))")
        precondition(opened == "true", "Delete must ask with the in-page dialog in WebKit")
        let saves = handler.actions.filter { $0 == "save" }.count
        let deleted = run("document.querySelector('#confirm-yes').click();''")
        wait { handler.actions.filter { $0 == "save" }.count > saves }
        precondition(deleted == "" && run("String(state.assets.length)") == "0", "Confirmed delete must remove the record")
        precondition(run("document.querySelector('#toast .toast-undo').click();String(state.assets.length)") == "1", "Toast undo must restore the record")
        let reading = run("window.assetboardAIResult({kind:'recognize',requestId:0,ok:true,evidenceId:'gmail-a',ai:{provider:'anthropic',model:'m',at:'t',text:'```json\\n{\"items\":[{\"name\":\"Figma Professional\",\"merchant\":\"Figma\",\"type\":\"subscription\",\"amount\":\"15\",\"currency\":\"USD\",\"cycle\":\"monthly\",\"date\":\"2099-10-06\",\"dateKind\":\"renew\"}]}\\n```'}});const c=candidates()[0];JSON.stringify([c.name,c.cost,c.date.source])")
        precondition(reading == "[\"Figma Professional\",\"$15 / 月\",\"ai\"]", "AI reading must parse in WebKit: " + reading)
        webView.appearance = NSAppearance(named: .aqua)
        wait { run("document.documentElement.dataset.scheme") == "light" }
        let lightCanvas = run("getComputedStyle(document.body).backgroundColor")
        webView.appearance = NSAppearance(named: .darkAqua)
        wait { run("document.documentElement.dataset.scheme") == "dark" }
        let darkCanvas = run("getComputedStyle(document.body).backgroundColor")
        precondition(lightCanvas != darkCanvas && handler.actions.filter { $0 == "themeColor" }.count >= 2, "Page must follow the system appearance: \(lightCanvas) / \(darkCanvas)")
        // Direct manipulation with synthetic pointer events: card reorder, cross-block move, edge resize.
        let setup = run("""
            state.blocks.push({id:'server',width:50,collapsed:false,height:null});
            state.assets.push({id:'b',type:'domain',name:'b.dev',provider:'R',account:'',art:'generic',source:'manual'},{id:'s',type:'server',name:'box',provider:'H',account:'',art:'generic',source:'manual'});
            render();
            window.__fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:7,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
            window.__center=el=>{const r=el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];};
            String(CSS.supports('translate','1px 2px')&&CSS.supports('scale','1.02'))
            """)
        check(setup == "true", "WebKit must support individual transform properties used by the drag lift")
        let reorder = run("""
            (()=>{const a=document.querySelector('[data-asset="a"]'),[ax,ay]=__center(a),[bx,by]=__center(document.querySelector('[data-asset="b"]'));
            __fire(a,'pointerdown',ax,ay);__fire(document,'pointermove',ax+10,ay);const lifted=a.classList.contains('is-dragging')&&getComputedStyle(a).position==='fixed';
            __fire(document,'pointermove',bx+40,by);const slot=!!document.querySelector('.domain .drop-slot');__fire(document,'pointerup',bx+40,by);return JSON.stringify({lifted,slot});})()
            """)
        check(reorder == "{\"lifted\":true,\"slot\":true}", "Card drag must lift and preview in WebKit: " + reorder)
        wait("card order") { run("String(state.cardOrder?.domain?.join(','))") == "b,a" && run("String(!document.querySelector('.drop-slot,.is-dragging'))") == "true" }
        let crossed = run("""
            (()=>{const b=document.querySelector('[data-asset="b"]'),server=document.querySelector('.block.server'),[x,y]=__center(b),[sx,sy]=__center(server);
            __fire(b,'pointerdown',x,y);__fire(document,'pointermove',x+10,y);__fire(document,'pointermove',sx,sy);const into=server.classList.contains('drop-into');__fire(document,'pointerup',sx,sy);return String(into);})()
            """)
        wait("cross-block category") { run("state.assets.find(a=>a.id==='b').type") == "server" }
        check(crossed == "true", "Cross-block target must be highlighted in WebKit")
        // The off-screen test view runs no animation frames, so the release applies the last pointer position directly.
        let resized = run("""
            (()=>{const edge=document.querySelector('.block.domain > .resize-edge[data-edge="x"]'),r=edge.getBoundingClientRect(),x=r.left+4,y=r.top+r.height/2;
            __fire(edge,'pointerdown',x,y);__fire(edge,'pointermove',x-60,y);__fire(edge,'pointerup',x-60,y);return String(state.blocks.find(b=>b.id==='domain').width<50);})()
            """)
        check(resized == "true", "Edge resize must change the width in WebKit")
        check(run("JSON.stringify(window.__errors)") == "[]", "Page reported script errors: " + run("JSON.stringify(window.__errors)"))
        print("PASS: WebKit board load, evidence bridge candidates, agenda, in-page delete confirmation, toast undo, AI reply parsing, light/dark appearance, card drag, cross-block move, edge resize")
    } catch { fputs("WebView test failed: \(error)\n", stderr); exit(1) }
}

func makeIcon(at path: String) {
    let image = NSImage(size: NSSize(width: 1024, height: 1024))
    image.lockFocus()
    NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.89, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 20, y: 20, width: 984, height: 984), xRadius: 220, yRadius: 220).fill()
    let tiles: [(NSRect, NSColor)] = [
        (NSRect(x: 176, y: 532, width: 390, height: 300), NSColor(calibratedRed: 0.35, green: 0.50, blue: 0.37, alpha: 1)),
        (NSRect(x: 598, y: 532, width: 250, height: 300), NSColor(calibratedRed: 0.64, green: 0.73, blue: 0.56, alpha: 1)),
        (NSRect(x: 176, y: 192, width: 250, height: 308), NSColor(calibratedRed: 0.74, green: 0.80, blue: 0.67, alpha: 1)),
        (NSRect(x: 458, y: 192, width: 390, height: 308), NSColor(calibratedRed: 0.49, green: 0.63, blue: 0.47, alpha: 1))
    ]
    for (rect, color) in tiles { color.setFill(); NSBezierPath(roundedRect: rect, xRadius: 50, yRadius: 50).fill() }
    image.unlockFocus()
    guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else { return }
    try? png.write(to: URL(fileURLWithPath: path))
}

@main struct AssetboardMain {
static func main() {
if CommandLine.arguments.contains("--make-icon"), let target = CommandLine.arguments.last {
    makeIcon(at: target)
} else if CommandLine.arguments.contains("--test-store") {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    do {
        let store = try BoardStore(root: root)
        let initial = try store.load()
        precondition(initial == nil)
        let data: [String: Any] = ["blocks": [["id": "domain"]], "assets": [["id": "test", "name": "test.dev", "type": "domain"]]]
        try store.save(data)
        let reopened = try BoardStore(root: root)
        let loaded = try reopened.load()
        precondition((loaded?["assets"] as? [[String: Any]])?.count == 1)
        let storedCount = try reopened.database.assetCount()
        precondition(storedCount == 1)
        try reopened.database.saveEvidence(id: "ocr-sample", kind: "ocr", source: "sample.png", title: "Sample", body: "Renewal notice", payload: ["date": "2026-09-20"])
        let evidence = try reopened.database.listEvidence()
        precondition(evidence.count == 1 && evidence[0]["body"] == "Renewal notice" && evidence[0]["payload"]?.contains("2026-09-20") == true)
        try reopened.database.saveEvidence(id: "ocr-long", kind: "ocr", source: "long.png", title: "Long", body: String(repeating: "x", count: 9000))
        let clipped = try reopened.database.listEvidence(bodyLimit: 6000).first { $0["id"] == "ocr-long" }
        precondition(clipped?["body"]?.count == 6000)
        try reopened.save(data)
        precondition(FileManager.default.fileExists(atPath: root.appendingPathComponent("board.previous.json").path))
        do { try reopened.save(["invalid": true]); fatalError("Invalid data accepted") } catch {}
        do { try reopened.save(["blocks": [["id": "unknown"]], "assets": []]); fatalError("Unknown category accepted") } catch {}
        let priority: [String: Any] = ["blocks": ["bankcard", "phone", "appleid", "google", "ai"].map { ["id": $0] },
                                       "assets": [["id": "card", "name": "Card", "type": "bankcard", "last4": "4821", "links": ["apple"]], ["id": "apple", "name": "Apple ID", "type": "appleid", "links": ["card"]]]]
        try reopened.save(priority)
        let priorityCount = try reopened.database.assetCount()
        precondition(priorityCount == 2, "Priority categories must save")
        try reopened.save(data)
        let afterInvalid = try reopened.load()
        precondition((afterInvalid?["assets"] as? [[String: Any]])?.count == 1)
        let oldRoot = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: oldRoot) }
        try FileManager.default.createDirectory(at: oldRoot, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: data).write(to: oldRoot.appendingPathComponent("board.json"))
        let migrated = try BoardStore(root: oldRoot)
        let migratedBoard = try migrated.load()
        let migratedCount = try migrated.database.assetCount()
        precondition((migratedBoard?["assets"] as? [[String: Any]])?.count == 1)
        precondition(migratedCount == 1)
        print("PASS: SQLite save, JSON migration and backup, reopen, reject invalid data and unknown categories, priority categories, evidence list payload and clipping")
    } catch { fputs("Store test failed: \(error)\n", stderr); exit(1) }
} else if CommandLine.arguments.contains("--test-cloudflare") {
    testCloudflare()
} else if CommandLine.arguments.contains("--test-github") {
    testGitHub()
} else if CommandLine.arguments.contains("--test-cloudflare-inventory") {
    testCloudflareInventory()
} else if CommandLine.arguments.contains("--test-ai") {
    testAI()
} else if CommandLine.arguments.contains("--test-local") {
    testLocalDirectory()
} else if CommandLine.arguments.contains("--test-icons") {
    testIcons()
} else if CommandLine.arguments.contains("--test-webview") {
    testWebView()
} else if CommandLine.arguments.contains("--test-ocr") {
    let sample = NSImage(size: NSSize(width: 900, height: 180))
    sample.lockFocus()
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: 900, height: 180).fill()
    ("ASSETBOARD 123" as NSString).draw(at: NSPoint(x: 35, y: 65), withAttributes: [.font: NSFont.systemFont(ofSize: 70), .foregroundColor: NSColor.black])
    sample.unlockFocus()
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
    defer { try? FileManager.default.removeItem(at: url) }
    guard let tiff = sample.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("OCR sample generation failed") }
    do {
        try png.write(to: url)
        let recognized = try OCRImporter.recognize(at: url)
        precondition(recognized.contains("ASSETBOARD"))
        print("PASS: local Vision image recognition")
    } catch { fputs("OCR test failed: \(error)\n", stderr); exit(1) }
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
}
}
