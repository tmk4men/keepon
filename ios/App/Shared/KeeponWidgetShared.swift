import Foundation

// アプリ本体とウィジェット拡張の両方に入れるファイル。
// Android 版の WidgetState.java と同じ JSON 形状を App Group の UserDefaults に置く。
// （Android は SharedPreferences "CapacitorStorage"、iOS は App Group。中身の形は同じ）

enum KeeponWidgetShared {
    static let appGroup = "group.app.tuzukin.diet"
    static let stateKey = "keepon_widget_state"
    static let pendingKey = "keepon_widget_pending"
    static let widgetKind = "KeeponWidget"

    static var store: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? UserDefaults.standard
    }

    /// 端末のカレンダーでの YYYY-MM-DD（JS 側の日付キーと揃える）
    static func todayString(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

struct KeeponWidgetState {
    var date: String?
    var todayMenu: String?
    var fullDone: Bool = false
    var timerRunning: Bool = false
    var timerStartedAt: Double = 0  // epoch ミリ秒（JS と揃える）
    var locked: Bool = false  // 体験切れ。ウィジェットからの操作を止める
    /// この日まで使える YYYY-MM-DD。空なら期限なし（購入済み）。
    /// アプリを開かないまま期限を過ぎた場合も、ウィジェット側だけで判断できるようにしている。
    var accessUntil: String = ""

    /// 実際に操作させてよいか。locked そのものではなく期限も見る。
    var isLocked: Bool {
        if locked { return true }
        if accessUntil.isEmpty { return false }
        return KeeponWidgetShared.todayString() > accessUntil
    }

    var startedDate: Date? {
        guard timerStartedAt > 0 else { return nil }
        return Date(timeIntervalSince1970: timerStartedAt / 1000)
    }

    static func read() -> KeeponWidgetState {
        var state = KeeponWidgetState()
        guard
            let raw = KeeponWidgetShared.store.string(forKey: KeeponWidgetShared.stateKey),
            let data = raw.data(using: .utf8),
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else {
            return state
        }

        state.date = json["date"] as? String
        state.todayMenu = json["todayMenu"] as? String
        state.fullDone = (json["fullDone"] as? NSNumber)?.boolValue ?? false
        state.timerRunning = (json["timerRunning"] as? NSNumber)?.boolValue ?? false
        state.timerStartedAt = (json["timerStartedAt"] as? NSNumber)?.doubleValue ?? 0
        state.locked = (json["locked"] as? NSNumber)?.boolValue ?? false
        state.accessUntil = json["accessUntil"] as? String ?? ""

        // 日次リセット：保存されている日付が今日でなければ完了/タイマーは持ち越さない。
        // メニュー名は次回アプリが上書きするまで残す（空表示よりマシ）。read は副作用なし。
        if let day = state.date, day != KeeponWidgetShared.todayString() {
            state.fullDone = false
            state.timerRunning = false
            state.timerStartedAt = 0
        }
        return state
    }

    func write() {
        var json: [String: Any] = [:]
        if let day = date, !day.isEmpty {
            json["date"] = day
        } else {
            json["date"] = KeeponWidgetShared.todayString()
        }
        if let menu = todayMenu {
            json["todayMenu"] = menu
        } else {
            json["todayMenu"] = NSNull()
        }
        json["fullDone"] = fullDone
        json["timerRunning"] = timerRunning
        json["timerStartedAt"] = timerStartedAt
        json["locked"] = locked
        json["accessUntil"] = accessUntil

        guard
            let data = try? JSONSerialization.data(withJSONObject: json),
            let raw = String(data: data, encoding: .utf8)
        else { return }
        KeeponWidgetShared.store.set(raw, forKey: KeeponWidgetShared.stateKey)
    }

    /// ウィジェット側で確定した記録を、アプリが拾うまで貯める
    static func appendPending(date: String, kind: String, menuTitle: String, minutes: Int) {
        var list = readPendingRaw()
        list.append([
            "date": date,
            "kind": kind,
            "menuTitle": menuTitle,
            "minutes": minutes
        ])
        writePendingRaw(list)
    }

    /// 貯まった記録を返して消す（二重適用を防ぐ）
    static func takePending() -> [[String: Any]] {
        let list = readPendingRaw()
        if !list.isEmpty {
            KeeponWidgetShared.store.removeObject(forKey: KeeponWidgetShared.pendingKey)
        }
        return list
    }

    private static func readPendingRaw() -> [[String: Any]] {
        guard
            let raw = KeeponWidgetShared.store.string(forKey: KeeponWidgetShared.pendingKey),
            let data = raw.data(using: .utf8),
            let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
        else {
            return []
        }
        return list
    }

    private static func writePendingRaw(_ list: [[String: Any]]) {
        guard
            let data = try? JSONSerialization.data(withJSONObject: list),
            let raw = String(data: data, encoding: .utf8)
        else { return }
        KeeponWidgetShared.store.set(raw, forKey: KeeponWidgetShared.pendingKey)
    }
}

// MARK: - ウィジェットのボタン操作（Android の WidgetActionReceiver と同じ挙動）

enum KeeponWidgetAction {
    /// 計測開始
    static func start() {
        var state = KeeponWidgetState.read()
        guard !state.isLocked, !state.fullDone, !state.timerRunning else { return }
        state.date = KeeponWidgetShared.todayString()
        state.timerRunning = true
        state.timerStartedAt = Date().timeIntervalSince1970 * 1000
        state.write()
    }

    /// 完了して記録（経過分を pending に積む）
    static func stop() {
        var state = KeeponWidgetState.read()
        guard !state.isLocked, state.timerRunning else { return }
        let elapsedMs = Date().timeIntervalSince1970 * 1000 - state.timerStartedAt
        let minutes = max(1, Int((elapsedMs / 60000).rounded()))
        var title = "今日のメニュー"
        if let menu = state.todayMenu, !menu.isEmpty {
            title = menu
        }
        KeeponWidgetState.appendPending(
            date: KeeponWidgetShared.todayString(),
            kind: "full",
            menuTitle: title,
            minutes: minutes
        )
        // 楽観的に「達成済み」を即反映（次のアプリ起動でも整合する）
        state.date = KeeponWidgetShared.todayString()
        state.timerRunning = false
        state.timerStartedAt = 0
        state.fullDone = true
        state.write()
    }
}
