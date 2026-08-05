import Capacitor
import Foundation
import WidgetKit

/// JS ↔ ホーム画面ウィジェットのブリッジ（iOS）。
/// Android は Preferences プラグイン経由で SharedPreferences を共有しているが、
/// iOS の拡張は App Group を通さないとアプリのデータを読めないため、
/// 状態の読み書き自体をこのプラグインで行う。
@objc(KeeponWidgetPlugin)
public class KeeponWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeeponWidgetPlugin"
    public let jsName = "KeeponWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pullPending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    /// アプリ側の状態をウィジェットに書き出して再描画する
    @objc func sync(_ call: CAPPluginCall) {
        var state = KeeponWidgetState()
        state.date = call.getString("date")
        state.todayMenu = call.getString("todayMenu")
        state.fullDone = call.getBool("fullDone") ?? false
        state.timerRunning = call.getBool("timerRunning") ?? false
        state.timerStartedAt = call.getDouble("timerStartedAt") ?? 0
        state.locked = call.getBool("locked") ?? false
        state.write()
        reloadWidgets()
        call.resolve()
    }

    /// ウィジェット側で確定した記録を取り出す（取り出したら消える）
    @objc func pullPending(_ call: CAPPluginCall) {
        let records: [JSObject] = KeeponWidgetState.takePending().compactMap { raw in
            guard
                let date = raw["date"] as? String,
                let kind = raw["kind"] as? String,
                let menuTitle = raw["menuTitle"] as? String,
                let minutes = (raw["minutes"] as? NSNumber)?.intValue
            else { return nil }
            return [
                "date": date,
                "kind": kind,
                "menuTitle": menuTitle,
                "minutes": minutes
            ]
        }
        call.resolve(["records": records])
    }

    /// 現在の共有状態を返す（ウィジェットで開始されたタイマーをアプリが引き継ぐため）
    @objc func getState(_ call: CAPPluginCall) {
        let state = KeeponWidgetState.read()
        let payload: JSObject = [
            "date": state.date ?? "",
            "todayMenu": state.todayMenu ?? "",
            "fullDone": state.fullDone,
            "timerRunning": state.timerRunning,
            "timerStartedAt": state.timerStartedAt,
            "locked": state.locked
        ]
        call.resolve(["state": payload])
    }

    /// 再描画だけをトリガーする
    @objc func update(_ call: CAPPluginCall) {
        reloadWidgets()
        call.resolve()
    }

    private func reloadWidgets() {
        WidgetCenter.shared.reloadTimelines(ofKind: KeeponWidgetShared.widgetKind)
    }
}
