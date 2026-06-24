import UIKit
import Capacitor

@objc(MyViewController)
public class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        NSLog("MyViewController: capacitorDidLoad called")
        bridge?.registerPluginType(AlternateIconPlugin.self)
        NSLog("MyViewController: AlternateIconPlugin registered")
    }
}
