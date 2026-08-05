package app.tuzukin.diet;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * ウィジェットとJSアプリで共有する状態を管理する。
 * @capacitor/preferences が使うのと同じ SharedPreferences "CapacitorStorage" を直接読み書きする。
 */
public class WidgetState {
    // @capacitor/preferences のデフォルトグループ名
    private static final String PREF_NAME = "CapacitorStorage";

    // 共有キー（JS側と一致させる）
    private static final String KEY_STATE = "keepon_widget_state";
    private static final String KEY_PENDING = "keepon_widget_pending";

    public String date;          // この状態が「いつの日」のものかを示す YYYY-MM-DD
    public String todayMenu;
    public boolean fullDone;
    public boolean timerRunning;
    public long timerStartedAt;
    public boolean locked;       // 体験切れ。ウィジェットからの操作を止める
    /** この日まで使える YYYY-MM-DD。空なら期限なし（購入済み）。 */
    public String accessUntil;

    public WidgetState() {
        this.date = null;
        this.todayMenu = null;
        this.fullDone = false;
        this.timerRunning = false;
        this.timerStartedAt = 0L;
        this.locked = false;
        this.accessUntil = "";
    }

    /**
     * 実際に操作させてよいか。locked そのものではなく期限も見る。
     * アプリを開かないまま体験が切れた場合も、ここで止まる。
     */
    public boolean isLocked() {
        if (locked) return true;
        if (accessUntil == null || accessUntil.isEmpty()) return false;
        return todayStr().compareTo(accessUntil) > 0;
    }

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static WidgetState read(Context ctx) {
        WidgetState s = new WidgetState();
        String raw = prefs(ctx).getString(KEY_STATE, null);
        if (raw == null || raw.isEmpty()) return s;
        try {
            JSONObject json = new JSONObject(raw);
            s.date = json.isNull("date") ? null : json.optString("date", null);
            s.todayMenu = json.isNull("todayMenu") ? null : json.optString("todayMenu", null);
            s.fullDone = json.optBoolean("fullDone", false);
            s.timerRunning = json.optBoolean("timerRunning", false);
            s.timerStartedAt = json.optLong("timerStartedAt", 0L);
            s.locked = json.optBoolean("locked", false);
            s.accessUntil = json.isNull("accessUntil") ? "" : json.optString("accessUntil", "");
        } catch (JSONException ignored) {
        }

        // 日次リセット：保存されている日付が今日と違うなら、完了/タイマー状態をクリア。
        // メニュー名は次回JSが上書きするまで残す（空表示よりはマシ）。
        String currentDate = todayStr();
        if (s.date != null && !currentDate.equals(s.date)) {
            s.fullDone = false;
            s.timerRunning = false;
            s.timerStartedAt = 0L;
            // 書き戻しは Receiver/Plugin の write 時に行う。read は副作用なし。
        }
        return s;
    }

    public static void write(Context ctx, WidgetState s) {
        try {
            JSONObject json = new JSONObject();
            // write 時点の date が未設定なら、今日の日付で補完する
            String d = (s.date != null && !s.date.isEmpty()) ? s.date : todayStr();
            json.put("date", d);
            if (s.todayMenu == null) json.put("todayMenu", JSONObject.NULL);
            else json.put("todayMenu", s.todayMenu);
            json.put("fullDone", s.fullDone);
            json.put("timerRunning", s.timerRunning);
            json.put("timerStartedAt", s.timerStartedAt);
            json.put("locked", s.locked);
            json.put("accessUntil", s.accessUntil == null ? "" : s.accessUntil);
            prefs(ctx).edit().putString(KEY_STATE, json.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    /** ウィジェット内のStop操作で確定した記録を、JSアプリが拾うまで貯める */
    public static void appendPendingRecord(Context ctx, String date, String kind, String menuTitle, int minutes) {
        try {
            String existing = prefs(ctx).getString(KEY_PENDING, null);
            JSONArray arr;
            if (existing == null || existing.isEmpty()) {
                arr = new JSONArray();
            } else {
                try {
                    arr = new JSONArray(existing);
                } catch (JSONException e) {
                    arr = new JSONArray();
                }
            }
            JSONObject rec = new JSONObject();
            rec.put("date", date);
            rec.put("kind", kind);
            rec.put("menuTitle", menuTitle);
            rec.put("minutes", minutes);
            arr.put(rec);
            prefs(ctx).edit().putString(KEY_PENDING, arr.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    public static String todayStr() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        fmt.setCalendar(Calendar.getInstance());
        return fmt.format(new Date());
    }
}
