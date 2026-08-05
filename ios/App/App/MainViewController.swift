import Capacitor
import UIKit

/// アプリ内で定義した独自プラグインを登録するためのブリッジ VC。
/// capacitor.config.json の packageClassList は cap sync が npm プラグインだけで
/// 作り直すため、ローカルのプラグインはここで明示的に登録する。
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(KeeponWidgetPlugin())
        bridge?.registerPluginInstance(PurchasePlugin())
    }
}
