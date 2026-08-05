import AppIntents
import WidgetKit

// ウィジェット内のボタン。iOS 17 以降だけアプリを開かずにその場で動く。
// iOS 16 以下はボタンを出さず、タップでアプリが開く。

@available(iOS 17.0, *)
struct KeeponStartIntent: AppIntent {
    static var title: LocalizedStringResource = "トレーニングを開始"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        KeeponWidgetAction.start()
        return .result()
    }
}

@available(iOS 17.0, *)
struct KeeponStopIntent: AppIntent {
    static var title: LocalizedStringResource = "完了して記録"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        KeeponWidgetAction.stop()
        return .result()
    }
}
