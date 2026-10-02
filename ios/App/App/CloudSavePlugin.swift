import Capacitor
import Foundation

/// iCloud key-value store bridge for Ludodex's cloud save (restore on a new
/// phone / reinstall). The save is one JSON string under one key; the store
/// follows the player's Apple ID. Needs the iCloud capability with
/// "Key-value storage" enabled (App.entitlements: ubiquity-kvstore-identifier).
@objc(CloudSavePlugin)
public class CloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSavePlugin"
    public let jsName = "CloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
    ]

    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeChanged(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        // Pull whatever iCloud already has for this Apple ID.
        store.synchronize()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// iCloud delivered newer data (e.g. first launch on a new phone).
    @objc private func storeChanged(_ notification: Notification) {
        notifyListeners("changed", data: [:])
    }

    @objc func get(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? "save"
        if let value = store.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve(["value": NSNull()])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }
}
