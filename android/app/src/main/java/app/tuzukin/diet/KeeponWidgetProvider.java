package app.tuzukin.diet;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

/**
 * ホーム画面ウィジェット本体。
 * 表示する状態は {@link WidgetState} から、ボタンの動作は {@link WidgetActionReceiver} に委譲する。
 */
public class KeeponWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, KeeponWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        WidgetState state = WidgetState.read(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_keepon);

        // メニュータイトル（未設定なら案内文）
        String title = state.todayMenu;
        if (title == null || title.isEmpty()) title = "アプリを開いて今日のメニューを表示";
        views.setTextViewText(R.id.widget_menu, title);

        if (state.fullDone) {
            // 達成済み：完了表示のみ
            views.setViewVisibility(R.id.widget_status_done, View.VISIBLE);
            views.setViewVisibility(R.id.widget_chrono, View.GONE);
            views.setViewVisibility(R.id.widget_btn_start, View.GONE);
            views.setViewVisibility(R.id.widget_btn_stop, View.GONE);
        } else if (state.timerRunning) {
            // 運動中：経過時間と「完了」ボタン
            views.setViewVisibility(R.id.widget_status_done, View.GONE);
            views.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
            views.setViewVisibility(R.id.widget_btn_start, View.GONE);
            views.setViewVisibility(R.id.widget_btn_stop, View.VISIBLE);

            long elapsedSinceStart = System.currentTimeMillis() - state.timerStartedAt;
            long base = SystemClock.elapsedRealtime() - Math.max(0L, elapsedSinceStart);
            views.setChronometer(R.id.widget_chrono, base, null, true);
        } else {
            // 待機中：開始ボタン
            views.setViewVisibility(R.id.widget_status_done, View.GONE);
            views.setViewVisibility(R.id.widget_chrono, View.GONE);
            views.setViewVisibility(R.id.widget_btn_start, View.VISIBLE);
            views.setViewVisibility(R.id.widget_btn_stop, View.GONE);
        }

        // 開始ボタン
        Intent startIntent = new Intent(context, WidgetActionReceiver.class);
        startIntent.setAction(WidgetActionReceiver.ACTION_START);
        views.setOnClickPendingIntent(
                R.id.widget_btn_start,
                PendingIntent.getBroadcast(
                        context,
                        1,
                        startIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                )
        );

        // 完了ボタン
        Intent stopIntent = new Intent(context, WidgetActionReceiver.class);
        stopIntent.setAction(WidgetActionReceiver.ACTION_STOP);
        views.setOnClickPendingIntent(
                R.id.widget_btn_stop,
                PendingIntent.getBroadcast(
                        context,
                        2,
                        stopIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                )
        );

        // メニュー行をタップ＝アプリを開く
        Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openIntent != null) {
            views.setOnClickPendingIntent(
                    R.id.widget_root,
                    PendingIntent.getActivity(
                            context,
                            3,
                            openIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    )
            );
        }

        manager.updateAppWidget(widgetId, views);
    }
}
