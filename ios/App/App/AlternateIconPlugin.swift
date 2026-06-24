import Capacitor
import UIKit

@objc(AlternateIconPlugin)
public class AlternateIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlternateIconPlugin"
    public let jsName = "AlternateIconPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIcon", returnType: CAPPluginReturnPromise),
    ]

    @objc func setIcon(_ call: CAPPluginCall) {
        call.keepAlive = true
        let icon = call.getString("icon") ?? "void"
        let iconName: String? = icon == "void" ? nil : icon

        DispatchQueue.main.async {
            let supports = UIApplication.shared.supportsAlternateIcons
            NSLog("AlternateIconPlugin: setIcon called with icon: %@. supportsAlternateIcons: %d", icon, supports)

            guard supports else {
                NSLog("AlternateIconPlugin: setIcon failed because alternate icons are not supported on this device/simulator.")
                call.reject("Alternate icons are not supported on this device/simulator.")
                return
            }

            UIApplication.shared.setAlternateIconName(iconName) { error in
                if let error {
                    NSLog("AlternateIconPlugin: setIcon failed with error: %@", error.localizedDescription)
                    call.reject(error.localizedDescription)
                } else {
                    NSLog("AlternateIconPlugin: setIcon succeeded for icon: %@", icon)
                    call.resolve(["icon": icon])
                }
            }
        }
    }

    @objc func getIcon(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let supports = UIApplication.shared.supportsAlternateIcons
            let icon = UIApplication.shared.alternateIconName ?? "void"
            NSLog("AlternateIconPlugin: getIcon called. supportsAlternateIcons: %d, returning: %@", supports, icon)
            call.resolve(["icon": icon, "supportsAlternateIcons": supports])
        }
    }
}
