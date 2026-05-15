package app.tuzukin.diet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * ウィジェット内ボタンのタップを受けるレシーバ。
 * 状態を {@link WidgetState} に書き込み、{@link KeeponWidgetProvider#updateAll(Context)} で再描画する。
 */
public class WidgetActionReceiver extends BroadcastReceiver {
    public static final String ACTION_START = "app.tuzukin.diet.WIDGET_START";
    public static final String ACTION_STOP = "app.tuzukin.diet.WIDGET_STOP";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        WidgetState state = WidgetState.read(context);

        switch (intent.getAction()) {
            case ACTION_START: {
                if (!state.fullDone && !state.timerRunning) {
                    state.timerRunning = true;
                    state.timerStartedAt = System.currentTimeMillis();
                    WidgetState.write(context, state);
                }
                break;
            }
            case ACTION_STOP: {
                if (state.timerRunning) {
                    long durationMs = System.currentTimeMillis() - state.timerStartedAt;
                    int minutes = Math.max(1, (int) Math.round(durationMs / 60000.0));
                    String title = state.todayMenu != null ? state.todayMenu : "今日のメニュー";
                    WidgetState.appendPendingRecord(
                            context,
                            WidgetState.todayStr(),
                            "full",
                            title,
                            minutes
                    );
                    // 楽観的に「達成済み」を即反映（次のアプリ起動でも整合）
                    state.timerRunning = false;
                    state.timerStartedAt = 0L;
                    state.fullDone = true;
                    WidgetState.write(context, state);
                }
                break;
            }
            default:
                break;
        }

        KeeponWidgetProvider.updateAll(context);
    }
}
