import Foundation
import Network
import Capacitor

/**
 * Durable outbox files, NWPathMonitor reachability, and URLSession background
 * transfers. Do not poll the network — wait for path updates.
 *
 * Background session identifier must stay stable across launches so iOS can
 * reconnect tasks after the app is killed.
 */
@objc(BackgroundUploadPlugin)
public class BackgroundUploadPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionTaskDelegate, URLSessionDelegate {
    public let identifier = "BackgroundUploadPlugin"
    public let jsName = "BackgroundUpload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getReachability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "persistQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "persistVideoFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fileExists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadPart", returnType: CAPPluginReturnPromise),
    ]

    private static let sessionIdentifier = "com.feedbacklive.app.upload"
    private static let queueFileName = "upload-outbox-queue.json"
    private static var backgroundCompletionHandler: (() -> Void)?
    private static weak var shared: BackgroundUploadPlugin?

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.feedback.background-upload.reachability")
    private var lastConnected = false
    private var lastExpensive = false
    private var urlSession: URLSession!
    private var pendingParts: [Int: (jobId: String, partNumber: Int)] = [:]
    private let stateLock = NSLock()

    public override func load() {
        super.load()
        BackgroundUploadPlugin.shared = self
        let config = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.shouldUseExtendedBackgroundIdleMode = true
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        startPathMonitor()
    }

    public static func handleBackgroundSession(
        identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        guard identifier == sessionIdentifier else {
            completionHandler()
            return
        }
        backgroundCompletionHandler = completionHandler
        // Recreate the session if the plugin is not loaded yet — iOS will
        // deliver delegate callbacks once the plugin's session exists.
        _ = shared?.urlSession
    }

    deinit {
        monitor.cancel()
    }

    private func outboxDirectory() throws -> URL {
        let appSupport = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = appSupport.appendingPathComponent("upload-outbox", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private func startPathMonitor() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let connected = path.status == .satisfied
            let expensive = path.isExpensive || path.isConstrained
            let changed: Bool = {
                self.stateLock.lock()
                defer { self.stateLock.unlock() }
                let changed = connected != self.lastConnected || expensive != self.lastExpensive
                self.lastConnected = connected
                self.lastExpensive = expensive
                return changed
            }()
            guard changed else { return }
            self.notifyListeners("reachabilityChange", data: [
                "connected": connected,
                "expensive": expensive,
            ])
        }
        monitor.start(queue: monitorQueue)
    }

    @objc func getReachability(_ call: CAPPluginCall) {
        let path = monitor.currentPath
        let connected = path.status == .satisfied
        call.resolve([
            "connected": connected,
            "expensive": path.isExpensive || path.isConstrained,
        ])
    }

    @objc func persistQueue(_ call: CAPPluginCall) {
        let json = call.getString("jobsJson") ?? "[]"
        do {
            let dir = try outboxDirectory()
            let url = dir.appendingPathComponent(Self.queueFileName)
            try Data(json.utf8).write(to: url, options: .atomic)
            call.resolve()
        } catch {
            call.reject("Failed to persist upload queue: \(error.localizedDescription)")
        }
    }

    @objc func loadQueue(_ call: CAPPluginCall) {
        do {
            let dir = try outboxDirectory()
            let url = dir.appendingPathComponent(Self.queueFileName)
            if !FileManager.default.fileExists(atPath: url.path) {
                call.resolve(["jobsJson": "[]"])
                return
            }
            let data = try Data(contentsOf: url)
            let json = String(data: data, encoding: .utf8) ?? "[]"
            call.resolve(["jobsJson": json])
        } catch {
            call.resolve(["jobsJson": "[]"])
        }
    }

    @objc func persistVideoFile(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), !jobId.isEmpty else {
            call.reject("Missing jobId")
            return
        }
        let sourcePath = call.getString("sourcePath")?.trimmingCharacters(in: .whitespacesAndNewlines)
        let fileName = call.getString("fileName") ?? "clip.mp4"
        let ext = (fileName as NSString).pathExtension.isEmpty ? "mp4" : (fileName as NSString).pathExtension
        do {
            let dir = try outboxDirectory()
            let dest = dir.appendingPathComponent("\(jobId).\(ext)")
            if let sourcePath, !sourcePath.isEmpty {
                let source = Self.fileURL(from: sourcePath)
                if FileManager.default.fileExists(atPath: dest.path) {
                    try FileManager.default.removeItem(at: dest)
                }
                try FileManager.default.copyItem(at: source, to: dest)
            } else if !FileManager.default.fileExists(atPath: dest.path) {
                call.reject("Missing sourcePath and no existing outbox file")
                return
            }
            call.resolve(["path": dest.path])
        } catch {
            call.reject("Failed to persist video file: \(error.localizedDescription)")
        }
    }

    @objc func fileExists(_ call: CAPPluginCall) {
        let path = call.getString("path")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !path.isEmpty else {
            call.resolve(["exists": false, "size": 0])
            return
        }
        let url = Self.fileURL(from: path)
        var isDir: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)
        let size: Int
        if exists, !isDir.boolValue, let attrs = try? FileManager.default.attributesOfItem(atPath: url.path) {
            size = (attrs[.size] as? NSNumber)?.intValue ?? 0
        } else {
            size = 0
        }
        call.resolve(["exists": exists && !isDir.boolValue, "size": size])
    }

    @objc func uploadPart(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), !jobId.isEmpty else {
            call.reject("Missing jobId")
            return
        }
        let partNumber = call.getInt("partNumber") ?? 0
        guard partNumber > 0 else {
            call.reject("Missing partNumber")
            return
        }
        guard let urlString = call.getString("url"), let remote = URL(string: urlString) else {
            call.reject("Missing url")
            return
        }
        guard let filePath = call.getString("filePath"), !filePath.isEmpty else {
            call.reject("Missing filePath")
            return
        }
        let offset = call.getInt("offset") ?? 0
        let length = call.getInt("length") ?? 0
        guard offset >= 0, length > 0 else {
            call.reject("Invalid offset/length")
            return
        }
        let method = (call.getString("httpMethod") ?? "PUT").uppercased()
        let extraHeaders = call.getObject("headers") ?? [:]

        DispatchQueue.global(qos: .utility).async {
            do {
                let source = Self.fileURL(from: filePath)
                let partFile = try self.writePartSlice(
                    from: source,
                    offset: UInt64(offset),
                    length: UInt64(length),
                    jobId: jobId,
                    partNumber: partNumber
                )
                var request = URLRequest(url: remote)
                request.httpMethod = method
                request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
                for (key, value) in extraHeaders {
                    if let stringValue = value as? String {
                        request.setValue(stringValue, forHTTPHeaderField: key)
                    }
                }
                self.withWebViewCookies(request, url: remote) { cookieRequest in
                    let task = self.urlSession.uploadTask(with: cookieRequest, fromFile: partFile)
                    self.stateLock.lock()
                    self.pendingParts[task.taskIdentifier] = (jobId, partNumber)
                    self.stateLock.unlock()
                    task.taskDescription = "\(jobId)#\(partNumber)"
                    task.resume()
                    call.resolve(["accepted": true])
                }
            } catch {
                call.reject("Failed to schedule background upload: \(error.localizedDescription)")
            }
        }
    }

    private func writePartSlice(
        from source: URL,
        offset: UInt64,
        length: UInt64,
        jobId: String,
        partNumber: Int
    ) throws -> URL {
        let dir = try outboxDirectory().appendingPathComponent("parts", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        let dest = dir.appendingPathComponent("\(jobId)-\(partNumber).bin")
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        FileManager.default.createFile(atPath: dest.path, contents: nil)
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        try input.seek(toOffset: offset)
        let output = try FileHandle(forWritingTo: dest)
        defer { try? output.close() }
        var remaining = length
        let bufSize = 1024 * 1024
        while remaining > 0 {
            let toRead = Int(min(UInt64(bufSize), remaining))
            let chunk = try input.read(upToCount: toRead)
            guard let chunk, !chunk.isEmpty else { break }
            try output.write(contentsOf: chunk)
            remaining -= UInt64(chunk.count)
        }
        if remaining > 0 {
            throw NSError(
                domain: "BackgroundUpload",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not read the requested file range"]
            )
        }
        return dest
    }

    /// WKWebView and WKHTTPCookieStore are main-thread objects; `uploadPart`
    /// calls this from a utility queue, so hop to main before touching them.
    private func withWebViewCookies(
        _ request: URLRequest,
        url: URL,
        done: @escaping (URLRequest) -> Void
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let store = self?.bridge?.webView?.configuration.websiteDataStore.httpCookieStore else {
                done(request)
                return
            }
            store.getAllCookies { cookies in
                var next = request
                let host = url.host ?? ""
                let matching = cookies.filter { cookie in
                    let domain = cookie.domain.hasPrefix(".") ? String(cookie.domain.dropFirst()) : cookie.domain
                    return host == cookie.domain || host.hasSuffix(domain)
                }
                if !matching.isEmpty {
                    let header = matching.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
                    next.setValue(header, forHTTPHeaderField: "Cookie")
                }
                done(next)
            }
        }
    }

    /// Identify the part a task belongs to. `pendingParts` is in-memory, so after
    /// iOS relaunches the app to deliver a finished background task the map is
    /// empty; the stable `taskDescription` ("jobId#partNumber") still names it.
    private func pendingPart(for task: URLSessionTask, remove: Bool) -> (jobId: String, partNumber: Int)? {
        stateLock.lock()
        defer { stateLock.unlock() }
        if let pending = remove
            ? pendingParts.removeValue(forKey: task.taskIdentifier)
            : pendingParts[task.taskIdentifier]
        {
            return pending
        }
        guard let description = task.taskDescription,
              let hash = description.lastIndex(of: "#"),
              let partNumber = Int(description[description.index(after: hash)...]),
              partNumber > 0
        else {
            return nil
        }
        let jobId = String(description[..<hash])
        return jobId.isEmpty ? nil : (jobId, partNumber)
    }

    private static func fileURL(from path: String) -> URL {
        if path.hasPrefix("file://") {
            return URL(fileURLWithPath: URL(string: path)?.path ?? path)
        }
        return URL(fileURLWithPath: path)
    }

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard let pending = pendingPart(for: task, remove: false) else { return }
        notifyListeners("uploadProgress", data: [
            "jobId": pending.jobId,
            "partNumber": pending.partNumber,
            "sentBytes": totalBytesSent,
            "totalBytes": totalBytesExpectedToSend,
        ])
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let pending = pendingPart(for: task, remove: true) else { return }
        let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
        if let error {
            notifyListeners("uploadPartFailed", data: [
                "jobId": pending.jobId,
                "partNumber": pending.partNumber,
                "status": status,
                "error": error.localizedDescription,
            ])
        } else if status >= 400 {
            notifyListeners("uploadPartFailed", data: [
                "jobId": pending.jobId,
                "partNumber": pending.partNumber,
                "status": status,
                "error": "Part \(pending.partNumber) upload failed: \(status)",
            ])
        } else {
            notifyListeners("uploadPartComplete", data: [
                "jobId": pending.jobId,
                "partNumber": pending.partNumber,
                "status": status == 0 ? 200 : status,
            ])
        }
        removePartFile(jobId: pending.jobId, partNumber: pending.partNumber)
    }

    public func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        let handler = Self.backgroundCompletionHandler
        Self.backgroundCompletionHandler = nil
        DispatchQueue.main.async {
            handler?()
        }
    }

    private func removePartFile(jobId: String, partNumber: Int) {
        guard let dir = try? outboxDirectory().appendingPathComponent("parts", isDirectory: true) else { return }
        let dest = dir.appendingPathComponent("\(jobId)-\(partNumber).bin")
        try? FileManager.default.removeItem(at: dest)
    }
}
