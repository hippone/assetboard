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
        let categories: Set<String> = ["domain", "server", "subscription", "database", "license", "repository", "deployment", "storage"]
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

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate, NSToolbarDelegate, NSSearchFieldDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var store: BoardStore!
    let cloudflare = CloudflareConnector()
    let github = GitHubConnector()
    var localRoot: URL!
    let searchField = NSSearchField(frame: NSRect(x: 0, y: 0, width: 200, height: 28))
    var layoutButton: NSButton!

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            store = try BoardStore()
            let saved = try store.load()
            guard let root = Bundle.main.resourceURL?.appendingPathComponent("Board", isDirectory: true) else { return }
            localRoot = root
            let controller = WKUserContentController()
            let initial: [String: Any] = ["data": saved as Any? ?? NSNull(), "cloudflareConnected": cloudflare.token() != nil, "githubConnected": github.token() != nil,
                                          "gmailConfigured": FileManager.default.fileExists(atPath: store.directory.appendingPathComponent("gmail-client.json").path)]
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
            window.title = "Assetboard"
            // The board currently supplies a light palette; match native controls/material.
            window.appearance = NSAppearance(named: .aqua)
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
        [.flexibleSpace, .init("search"), .init("theme"), .init("layout"), .init("add")]
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
        case "layout":
            layoutButton = NSButton(title: "调整布局", target: self, action: #selector(toggleLayout))
            layoutButton.bezelStyle = .rounded
            item.label = "调整布局"
            item.view = layoutButton
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
    @objc func toggleLayout() { webView.evaluateJavaScript("document.querySelector('#edit').click()") }
    @objc func addBlock() { webView.evaluateJavaScript("document.querySelector('#add-block').click()") }
    @objc func focusSearch() { window.makeFirstResponder(searchField) }
    @objc func openTheme() { webView.evaluateJavaScript("themeDialog()") }
    @objc func openCloudflare() { webView.evaluateJavaScript("cloudflareDialog()") }
    @objc func openGitHub() { webView.evaluateJavaScript("githubDialog()") }
    @objc func openGmail() { webView.evaluateJavaScript("gmailDialog()") }
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
            panel.message = "选择从 Google Cloud 下载的桌面应用 OAuth 客户端 JSON。"
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
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType.png, .jpeg, .pdf] + [UTType(filenameExtension: "webp")].compactMap { $0 }
        panel.allowsMultipleSelection = false
        panel.message = "选择截图或 PDF；文字只在此 Mac 识别和保存。"
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { return }
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let text = try OCRImporter.recognize(at: url)
                    let digest = SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
                    DispatchQueue.main.async {
                        do {
                            try self.store.database.saveEvidence(id: "ocr-" + digest, kind: "ocr", source: url.lastPathComponent, title: url.lastPathComponent, body: text)
                            self.ocrResult(["ok": true, "title": url.lastPathComponent, "body": String(text.prefix(2000))])
                        } catch { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
                    }
                } catch {
                    DispatchQueue.main.async { self.ocrResult(["ok": false, "error": error.localizedDescription]) }
                }
            }
        }
    }
    @objc func showImportedEvidence() {
        do {
            let rows = try store.database.listEvidence()
            guard let data = try? JSONSerialization.data(withJSONObject: rows), let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.assetboardEvidenceResult(\(json))")
        } catch { ocrResult(["ok": false, "error": error.localizedDescription]) }
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

    func syncGitHubWithLocalCLI() {
        DispatchQueue.global(qos: .userInitiated).async {
            let paths = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"]
            guard let path = paths.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
                self.githubResult(["ok": false, "error": "未找到本机 GitHub CLI。请安装 gh 并登录，或使用 GitHub 令牌。"])
                return
            }
            let process = Process()
            process.executableURL = URL(fileURLWithPath: path)
            process.arguments = ["auth", "token"]
            process.standardError = FileHandle.nullDevice
            let output = Pipe()
            process.standardOutput = output
            do { try process.run() } catch {
                self.githubResult(["ok": false, "error": "无法读取本机 gh 登录。请检查 gh auth status。"])
                return
            }
            let data = output.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            guard process.terminationStatus == 0,
                  let token = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !token.isEmpty else {
                self.githubResult(["ok": false, "error": "本机 gh 尚未登录 GitHub，或无法读取其令牌。"])
                return
            }
            self.github.listRepositories(token: token) { repositories, error in
                if let error { self.githubResult(["ok": false, "error": error]); return }
                self.githubResult(["ok": true, "repositories": repositories ?? [], "connected": false])
            }
        }
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
        if body["action"] as? String == "toolbarState" {
            layoutButton.title = body["editing"] as? Bool == true ? "完成" : "调整布局"
            searchField.stringValue = body["query"] as? String ?? ""
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
            syncGitHubWithLocalCLI()
            return
        }
        if body["action"] as? String == "ocrImport" {
            importDocumentOCR()
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
        let exportItem = NSMenuItem(title: "导出资产备份…", action: #selector(exportBoard), keyEquivalent: "s")
        exportItem.keyEquivalentModifierMask = [.command, .shift]
        exportItem.target = self
        fileMenu.addItem(exportItem)
        let cloudflareItem = NSMenuItem(title: "Cloudflare 只读接入…", action: #selector(openCloudflare), keyEquivalent: "")
        cloudflareItem.target = self
        fileMenu.addItem(cloudflareItem)
        let githubItem = NSMenuItem(title: "GitHub 只读接入…", action: #selector(openGitHub), keyEquivalent: "")
        githubItem.target = self
        fileMenu.addItem(githubItem)
        let gmailItem = NSMenuItem(title: "Gmail 账单与服务通知…", action: #selector(openGmail), keyEquivalent: "")
        gmailItem.target = self
        fileMenu.addItem(gmailItem)
        let ocrItem = NSMenuItem(title: "导入截图或 PDF（本地识别）…", action: #selector(importDocumentOCR), keyEquivalent: "")
        ocrItem.target = self
        fileMenu.addItem(ocrItem)
        let evidenceItem = NSMenuItem(title: "查看导入资料…", action: #selector(showImportedEvidence), keyEquivalent: "")
        evidenceItem.target = self
        fileMenu.addItem(evidenceItem)
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
        for (title, action, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApplication.shared.mainMenu = menu
    }

    @objc func openDataFolder() { NSWorkspace.shared.open(store.directory) }
    @objc func exportBoard() {
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
        default: fatalError("Unexpected Cloudflare endpoint")
        }
    }
    do {
        let result = try inventory.discover(token: "test-token")
        precondition((result["resources"] as? [[String: String]])?.count == 4)
        precondition(Set(result["queriedKinds"] as? [String] ?? []) == Set(["zone", "pages", "worker", "r2"]))
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
        try reopened.database.saveEvidence(id: "ocr-sample", kind: "ocr", source: "sample.png", title: "Sample", body: "Renewal notice")
        let evidence = try reopened.database.listEvidence()
        precondition(evidence.count == 1 && evidence[0]["body"] == "Renewal notice")
        try reopened.save(data)
        precondition(FileManager.default.fileExists(atPath: root.appendingPathComponent("board.previous.json").path))
        do { try reopened.save(["invalid": true]); fatalError("Invalid data accepted") } catch {}
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
        print("PASS: SQLite save, JSON migration and backup, reopen, reject invalid data")
    } catch { fputs("Store test failed: \(error)\n", stderr); exit(1) }
} else if CommandLine.arguments.contains("--test-cloudflare") {
    testCloudflare()
} else if CommandLine.arguments.contains("--test-github") {
    testGitHub()
} else if CommandLine.arguments.contains("--test-cloudflare-inventory") {
    testCloudflareInventory()
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
