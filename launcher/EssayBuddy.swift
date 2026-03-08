import Cocoa
@preconcurrency import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {

    private var window: NSWindow!
    private var subtitleLabel: NSTextField!
    private var apiProcess: Process?
    private var webProcess: Process?

    // MARK: - Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildLoadingWindow()

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.setupAndLaunch()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopServers()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows { window?.makeKeyAndOrderFront(nil) }
        return true
    }

    // MARK: - Menu

    private func buildMenu() {
        let mainMenu = NSMenu()

        // App menu
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(NSMenuItem(title: "Hide Zora",
                                   action: #selector(NSApplication.hide(_:)),
                                   keyEquivalent: "h"))
        appMenu.addItem(NSMenuItem(title: "Hide Others",
                                   action: #selector(NSApplication.hideOtherApplications(_:)),
                                   keyEquivalent: "H"))
        appMenu.addItem(NSMenuItem(title: "Show All",
                                   action: #selector(NSApplication.unhideAllApplications(_:)),
                                   keyEquivalent: ""))
        appMenu.addItem(.separator())
        appMenu.addItem(NSMenuItem(title: "Quit Zora",
                                   action: #selector(NSApplication.terminate(_:)),
                                   keyEquivalent: "q"))

        // Edit menu — needed for Cmd+C/V/X/A to work inside WKWebView
        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editItem.submenu = editMenu
        editMenu.addItem(NSMenuItem(title: "Undo",  action: Selector(("undo:")),  keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "Redo",  action: Selector(("redo:")),  keyEquivalent: "Z"))
        editMenu.addItem(.separator())
        editMenu.addItem(NSMenuItem(title: "Cut",   action: #selector(NSText.cut(_:)),   keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copy",  action: #selector(NSText.copy(_:)),  keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))

        // Window menu
        let windowItem = NSMenuItem()
        mainMenu.addItem(windowItem)
        let windowMenu = NSMenu(title: "Window")
        windowItem.submenu = windowMenu
        windowMenu.addItem(NSMenuItem(title: "Close",    action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        windowMenu.addItem(NSMenuItem(title: "Minimize", action: #selector(NSWindow.miniaturize(_:)),  keyEquivalent: "m"))

        NSApp.mainMenu = mainMenu
    }

    // MARK: - Servers

    private func launchServers() {
        let repo = repoPath()

        apiProcess = shell(
            "source .venv/bin/activate && python3 main.py",
            cwd: "\(repo)/api"
        )
        webProcess = shell(
            "NEXT_PUBLIC_API_URL=http://localhost:8002 npm run serve",
            cwd: "\(repo)/web"
        )

        try? apiProcess?.run()
        try? webProcess?.run()
    }

    private func stopServers() {
        apiProcess?.terminate()
        webProcess?.terminate()
    }

    // MARK: - Setup & Install

    private func setStatus(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.subtitleLabel?.stringValue = text
        }
    }

    private func runSync(_ command: String, cwd: String) -> (ok: Bool, output: String) {
        let p = Process()
        let pipe = Pipe()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-l", "-c", command]
        p.currentDirectoryURL = URL(fileURLWithPath: cwd)
        p.standardOutput = pipe
        p.standardError = pipe
        do {
            try p.run()
            p.waitUntilExit()
        } catch {
            return (false, error.localizedDescription)
        }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8) ?? ""
        return (p.terminationStatus == 0, output)
    }

    private func repoPath() -> String {
        // Resolve repo path: walk up from the binary to find the project root.
        // Binary lives at: <repo>/launcher/dist/EssayBuddy.app/Contents/MacOS/EssayBuddy
        // So repo = binary/../../../../../..
        if let execURL = Bundle.main.executableURL {
            let dir = execURL
                .deletingLastPathComponent()  // MacOS/
                .deletingLastPathComponent()  // Contents/
                .deletingLastPathComponent()  // EssayBuddy.app/
                .deletingLastPathComponent()  // dist/
                .deletingLastPathComponent()  // launcher/
            let candidate = dir.appendingPathComponent("api/main.py").path
            if FileManager.default.fileExists(atPath: candidate) {
                return dir.path
            }
        }
        // Fallback: search common clone locations
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            "\(home)/Projects/essaybuddy",
            "\(home)/projects/essaybuddy",
            "\(home)/Code/essaybuddy",
            "\(home)/code/essaybuddy",
            "\(home)/Developer/essaybuddy",
            "\(home)/essaybuddy",
            "\(home)/Desktop/essaybuddy",
        ]
        for path in candidates {
            if FileManager.default.fileExists(atPath: "\(path)/api/main.py") {
                return path
            }
        }
        return "\(home)/Projects/essaybuddy"
    }

    private func setupAndLaunch() {
        let repo = repoPath()
        let fm = FileManager.default

        // Verify the repo actually exists
        if !fm.fileExists(atPath: "\(repo)/api/main.py") {
            DispatchQueue.main.async {
                self.showError("Project not found at:\n\(repo)\n\nClone the repo and relaunch, or ask your AI CLI:\n  \"Clone essaybuddy to ~/Projects/essaybuddy\"")
            }
            return
        }

        // Ensure data directories exist
        setStatus("Checking environment...")
        for sub in ["essays", "samples", "samples/files", "profiles"] {
            let dir = "\(repo)/data/\(sub)"
            if !fm.fileExists(atPath: dir) {
                try? fm.createDirectory(atPath: dir, withIntermediateDirectories: true)
            }
        }

        // Check python3 exists and version >= 3.9
        let pyCheck = runSync("python3 -c \"import sys; v=sys.version_info; exit(0 if v>=(3,9) else 1)\"", cwd: repo)
        if !pyCheck.ok {
            let pyVer = runSync("python3 --version 2>&1 || echo 'not found'", cwd: repo)
            DispatchQueue.main.async {
                self.showError("Python 3.9+ is required.\nFound: \(pyVer.output.trimmingCharacters(in: .whitespacesAndNewlines))\n\nOpen your terminal and ask your AI CLI:\n  \"Install Python 3.12 on this Mac\"")
            }
            return
        }

        // Check node exists and version >= 18
        let nodeCheck = runSync("node -e \"process.exit(parseInt(process.version.slice(1))>=18?0:1)\"", cwd: repo)
        if !nodeCheck.ok {
            let nodeVer = runSync("node --version 2>&1 || echo 'not found'", cwd: repo)
            DispatchQueue.main.async {
                self.showError("Node.js 18+ is required.\nFound: \(nodeVer.output.trimmingCharacters(in: .whitespacesAndNewlines))\n\nOpen your terminal and ask your AI CLI:\n  \"Install Node.js 22 LTS on this Mac\"")
            }
            return
        }

        // Check npm exists
        let npmCheck = runSync("which npm", cwd: repo)
        if !npmCheck.ok {
            DispatchQueue.main.async {
                self.showError("npm not found (Node.js is installed but npm is missing).\n\nOpen your terminal and ask your AI CLI:\n  \"Install npm on this Mac\"")
            }
            return
        }

        // Kill stale processes on our ports
        setStatus("Clearing ports...")
        _ = runSync("lsof -ti:8002 | xargs kill -9 2>/dev/null; true", cwd: repo)
        _ = runSync("lsof -ti:3031 | xargs kill -9 2>/dev/null; true", cwd: repo)

        // Auto-create Python venv + install requirements
        if !fm.fileExists(atPath: "\(repo)/api/.venv/bin/python3") {
            setStatus("Creating Python virtual environment...")
            let venv = runSync("python3 -m venv .venv", cwd: "\(repo)/api")
            if !venv.ok {
                DispatchQueue.main.async { self.showError("Failed to create Python venv.\n\nOpen your terminal in \(repo) and ask your AI CLI:\n  \"Set up the Python venv for EssayBuddy\"\n\n\(venv.output.suffix(300))") }
                return
            }

            setStatus("Installing Python dependencies...")
            let pip = runSync("source .venv/bin/activate && pip install -r requirements.txt", cwd: "\(repo)/api")
            if !pip.ok {
                DispatchQueue.main.async { self.showError("Failed to install Python dependencies.\n\nOpen your terminal in \(repo)/api and ask your AI CLI:\n  \"Fix pip install for EssayBuddy\"\n\n\(pip.output.suffix(300))") }
                return
            }
        }

        // Auto-install npm packages
        if !fm.fileExists(atPath: "\(repo)/web/node_modules") {
            setStatus("Installing npm packages...")
            let npm = runSync("npm install", cwd: "\(repo)/web")
            if !npm.ok {
                DispatchQueue.main.async { self.showError("Failed to install npm packages.\n\nOpen your terminal in \(repo)/web and ask your AI CLI:\n  \"Fix npm install for EssayBuddy\"\n\n\(npm.output.suffix(300))") }
                return
            }
        }

        setStatus("Starting servers...")
        DispatchQueue.main.async { [weak self] in
            self?.launchServers()
            self?.waitForServer(url: "http://localhost:8002/health", attempts: 45) { [weak self] in
                self?.waitForServer(url: "http://localhost:3031", attempts: 60) {
                    DispatchQueue.main.async { self?.openEditor() }
                }
            }
        }
    }

    private func shell(_ command: String, cwd: String) -> Process {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-l", "-c", command]
        p.currentDirectoryURL = URL(fileURLWithPath: cwd)
        p.standardOutput = FileHandle.nullDevice
        p.standardError  = FileHandle.nullDevice
        return p
    }

    // MARK: - Health polling

    private func waitForServer(url: String, attempts: Int, completion: @escaping () -> Void) {
        guard attempts > 0 else {
            DispatchQueue.main.async {
                self.showError("A server did not start in time.\n\nOpen your terminal in the essaybuddy project folder and ask your AI CLI:\n  \"EssayBuddy servers won't start — diagnose and fix\"")
            }
            return
        }
        guard let u = URL(string: url) else { return }

        var req = URLRequest(url: u)
        req.timeoutInterval = 2

        URLSession.shared.dataTask(with: req) { [weak self] _, resp, _ in
            let ok = (resp as? HTTPURLResponse).map { $0.statusCode < 500 } ?? false
            if ok {
                completion()
            } else {
                DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                    self?.waitForServer(url: url, attempts: attempts - 1, completion: completion)
                }
            }
        }.resume()
    }

    // MARK: - Windows

    private func buildLoadingWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 340, height: 160),
            styleMask:   [.titled, .closable, .fullSizeContentView],
            backing:     .buffered,
            defer:       false
        )
        window.titlebarAppearsTransparent = true
        window.title = "Zora"
        window.isMovableByWindowBackground = true
        window.center()

        let root = NSView()
        root.translatesAutoresizingMaskIntoConstraints = false

        let spinner = NSProgressIndicator()
        spinner.style = .spinning
        spinner.controlSize = .regular
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimation(nil)

        let titleLabel = NSTextField(labelWithString: "Zora")
        titleLabel.font = .boldSystemFont(ofSize: 15)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        subtitleLabel = NSTextField(labelWithString: "Starting servers...")
        subtitleLabel.font = .systemFont(ofSize: 13)
        subtitleLabel.textColor = .secondaryLabelColor
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false

        [spinner, titleLabel, subtitleLabel].forEach { root.addSubview($0) }
        window.contentView = root

        NSLayoutConstraint.activate([
            root.widthAnchor.constraint(equalToConstant: 340),
            root.heightAnchor.constraint(equalToConstant: 160),

            spinner.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: root.centerYAnchor, constant: -18),

            titleLabel.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            titleLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 14),

            subtitleLabel.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
        ])

        window.makeKeyAndOrderFront(nil)
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView,
                 decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(.allow)
    }

    // MARK: - WKUIDelegate (file input support)

    func webView(_ webView: WKWebView,
                 runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.begin { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    private func openEditor() {
        let wv = WKWebView()
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.load(URLRequest(url: URL(string: "http://localhost:3031")!))

        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.titlebarAppearsTransparent = false
        window.contentView = wv
        window.setContentSize(NSSize(width: 1400, height: 900))
        window.minSize = NSSize(width: 900, height: 600)
        window.center()
        window.title = "Zora"
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Failed to Start"
        alert.informativeText = message
        alert.addButton(withTitle: "Quit")
        alert.runModal()
        NSApp.terminate(nil)
    }
}

// Entry point
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.activate(ignoringOtherApps: true)
app.run()
