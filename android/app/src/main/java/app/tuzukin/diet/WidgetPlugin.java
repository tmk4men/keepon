package app.tuzukin.diet;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS側からウィジェット再描画をトリガーするためのCapacitorプラグイン。
 */
@CapacitorPlugin(name = "KeeponWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        KeeponWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
