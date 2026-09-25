import Cocoa
import WebKit

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
            let initial: [String: Any] = ["data": saved as Any? ?? NSNull()]
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
} else {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
