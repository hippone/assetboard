import Cocoa
import WebKit
import Security

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

// A local-only host. No HTTP server, remote renderer, or account is required.
final class BoardStore {
    let directory: URL
    let file: URL
    init(root: URL? = nil) throws {
        directory = root ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Assetboard", isDirectory: true)
        file = directory.appendingPathComponent("board.json")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    func validate(_ value: Any) throws -> [String: Any] {
        let categories: Set<String> = ["domain", "server", "subscription", "database", "license"]
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
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        return try validate(JSONSerialization.jsonObject(with: Data(contentsOf: file)))
    }
    func save(_ value: Any) throws {
        let board = try validate(value)
        let bytes = try JSONSerialization.data(withJSONObject: board, options: [.prettyPrinted, .sortedKeys])
        if FileManager.default.fileExists(atPath: file.path) {
            let previous = try Data(contentsOf: file)
            try previous.write(to: directory.appendingPathComponent("board.previous.json"), options: .atomic)
        }
        try bytes.write(to: file, options: .atomic)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate, NSToolbarDelegate, NSSearchFieldDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var store: BoardStore!
    let cloudflare = CloudflareConnector()
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
            let initial: [String: Any] = ["data": saved as Any? ?? NSNull(), "cloudflareConnected": cloudflare.token() != nil]
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

    func cloudflareResult(_ result: [String: Any]) {
        DispatchQueue.main.async {
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.assetboardCloudflareResult(\(json))")
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
            cloudflare.listZones(token: token) { zones, error in
                if let error { self.cloudflareResult(["ok": false, "error": error]); return }
                if !supplied.isEmpty && !self.cloudflare.saveToken(supplied) {
                    self.cloudflareResult(["ok": false, "error": "无法将令牌保存到 macOS 钥匙串，同步未写入资产板。"]) ; return
                }
                self.cloudflareResult(["ok": true, "zones": zones ?? [], "connected": true])
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
                let data = try Data(contentsOf: self.store.file)
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
    static var reply: ((URLRequest) -> (Int, [String: Any]))!
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
    func run(_ reply: @escaping (URLRequest) -> (Int, [String: Any])) -> ([[String: String]]?, String?) {
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
        try reopened.save(data)
        precondition(FileManager.default.fileExists(atPath: root.appendingPathComponent("board.previous.json").path))
        do { try reopened.save(["invalid": true]); fatalError("Invalid data accepted") } catch {}
        let afterInvalid = try reopened.load()
        precondition((afterInvalid?["assets"] as? [[String: Any]])?.count == 1)
        print("PASS: new store, atomic save, reopen, backup, reject invalid data")
    } catch { fputs("Store test failed: \(error)\n", stderr); exit(1) }
} else if CommandLine.arguments.contains("--test-cloudflare") {
    testCloudflare()
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
