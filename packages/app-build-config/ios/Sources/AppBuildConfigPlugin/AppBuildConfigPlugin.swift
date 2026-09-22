import Foundation
import Capacitor

/**
 * Exposes build-time native configuration to the WebView.
 *
 * The JS bundle is served from `server.url`, so one deploy runs inside every
 * installed binary. Anything that differs per binary — here, whether Google
 * Sign-In was compiled in with its reversed-client-id URL scheme — has to be
 * read from the bundle at runtime. GoogleSignIn raises an NSException (a hard
 * crash) when `signIn` runs without that scheme in CFBundleURLTypes, so the
 * WebView must ask before choosing the native SDK over browser OAuth.
 */
@objc(AppBuildConfigPlugin)
public class AppBuildConfigPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppBuildConfigPlugin"
    public let jsName = "AppBuildConfig"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getGoogleSignInConfig", returnType: CAPPluginReturnPromise),
    ]

    private static let googleClientIdSuffix = ".apps.googleusercontent.com"

    @objc func getGoogleSignInConfig(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary ?? [:]
        let rawClientId = (info["GIDClientID"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let clientId = Self.isValidClientId(rawClientId) ? rawClientId : nil
        let expectedScheme = clientId.flatMap(Self.reversedClientIdScheme)
        let schemes = Self.registeredUrlSchemes(info)
        let schemeRegistered = expectedScheme.map { schemes.contains($0.lowercased()) } ?? false

        call.resolve([
            "iosClientId": clientId ?? NSNull(),
            "urlScheme": expectedScheme ?? NSNull(),
            "urlSchemeRegistered": schemeRegistered,
        ])
    }

    static func isValidClientId(_ value: String) -> Bool {
        value.count > googleClientIdSuffix.count && value.hasSuffix(googleClientIdSuffix)
    }

    /// `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`
    static func reversedClientIdScheme(_ clientId: String) -> String? {
        guard isValidClientId(clientId) else { return nil }
        let prefix = String(clientId.dropLast(googleClientIdSuffix.count))
        return "com.googleusercontent.apps.\(prefix)"
    }

    static func registeredUrlSchemes(_ info: [String: Any]) -> Set<String> {
        var schemes = Set<String>()
        for type in (info["CFBundleURLTypes"] as? [[String: Any]]) ?? [] {
            for scheme in (type["CFBundleURLSchemes"] as? [String]) ?? [] {
                schemes.insert(scheme.lowercased())
            }
        }
        return schemes
    }
}
