import SwiftUI
import WidgetKit

// ホーム画面ウィジェット本体。Android 版 KeeponWidgetProvider と同じ3状態を出す。
// 待機中: 開始ボタン / 運動中: 経過時間＋完了ボタン / 達成済み: 記録ずみ表示

private let brandColor = Color(red: 0.247, green: 0.490, blue: 0.431)  // #3f7d6e
private let brandDeep = Color(red: 0.184, green: 0.365, blue: 0.322)  // #2f5d52
private let inkColor = Color(red: 0.173, green: 0.165, blue: 0.149)  // #2c2a26
private let cardColor = Color.white

struct KeeponEntry: TimelineEntry {
    let date: Date
    let state: KeeponWidgetState
}

struct KeeponProvider: TimelineProvider {
    func placeholder(in context: Context) -> KeeponEntry {
        var sample = KeeponWidgetState()
        sample.todayMenu = "スクワット 15回 × 2セット"
        return KeeponEntry(date: Date(), state: sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (KeeponEntry) -> Void) {
        completion(KeeponEntry(date: Date(), state: KeeponWidgetState.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KeeponEntry>) -> Void) {
        let entry = KeeponEntry(date: Date(), state: KeeponWidgetState.read())
        // 日付が変わると「今日は記録ずみ」が消えるので、翌0時に必ず作り直す
        completion(Timeline(entries: [entry], policy: .after(nextMidnight())))
    }

    private func nextMidnight() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date())
        guard let tomorrow = tomorrow else {
            return Date().addingTimeInterval(3600)
        }
        return calendar.startOfDay(for: tomorrow)
    }
}

struct KeeponWidgetEntryView: View {
    var entry: KeeponEntry

    private var menuTitle: String {
        let title = entry.state.todayMenu ?? ""
        return title.isEmpty ? "アプリを開いて今日のメニューを表示" : title
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            // iOS 17 以降は OS 側が余白を付けるので自前のパディングは足さない
            content.containerBackground(cardColor, for: .widget)
        } else {
            content.padding(14).background(cardColor)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ツヅキン")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(brandColor)

            Text(menuTitle)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(inkColor)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            if entry.state.timerRunning, !entry.state.isLocked,
                let startedAt = entry.state.startedDate
            {
                Text(startedAt, style: .timer)
                    .font(.system(size: 22, weight: .bold).monospacedDigit())
                    .foregroundColor(brandColor)
            }

            if entry.state.fullDone, !entry.state.isLocked {
                Text("今日は記録ずみ。お疲れさま！")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(brandColor)
                    .padding(.top, 6)
            }

            Spacer(minLength: 6)

            actionArea
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var actionArea: some View {
        if entry.state.isLocked {
            // 体験が終わっているので、ウィジェットからは始められない
            Text("タップしてアプリを開く")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(brandColor)
        } else if entry.state.fullDone {
            EmptyView()
        } else if #available(iOS 17.0, *) {
            if entry.state.timerRunning {
                Button(intent: KeeponStopIntent()) {
                    pill(text: "完了して記録", color: brandDeep)
                }
                .buttonStyle(.plain)
            } else {
                Button(intent: KeeponStartIntent()) {
                    pill(text: "開始", color: brandColor)
                }
                .buttonStyle(.plain)
            }
        } else {
            // iOS 16 以下はウィジェット内で処理できないため、タップでアプリを開く
            pill(
                text: entry.state.timerRunning ? "アプリで完了する" : "アプリで開始する",
                color: entry.state.timerRunning ? brandDeep : brandColor
            )
        }
    }

    private func pill(text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous).fill(color)
            )
    }
}

struct KeeponWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: KeeponWidgetShared.widgetKind, provider: KeeponProvider()) { entry in
            KeeponWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("ツヅキン")
        .description("今日のメニューを、アプリを開かずに開始・完了できます。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
