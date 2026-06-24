package app.ludodex.game;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * AlternateIconPlugin — switch the launcher icon at runtime.
 *
 * Uses the activity-alias approach: one alias per icon variant, each
 * enabled/disabled via PackageManager. Only one alias (or the main
 * activity) is enabled at a time.
 *
 * JS call:  AlternateIconPlugin.setIcon({ icon: 'void' | 'neon-horizon' | 'dot-matrix' })
 */
@CapacitorPlugin(name = "AlternateIconPlugin")
public class AlternateIconPlugin extends Plugin {

    // Component name suffixes defined in AndroidManifest.xml
    private static final String PKG = "app.ludodex.game";
    private static final String MAIN         = PKG + ".MainActivity";
    private static final String LUMEN        = PKG + ".MainActivityLumen";
    private static final String NEON_HORIZON = PKG + ".MainActivityNeonHorizon";
    private static final String DOT_MATRIX   = PKG + ".MainActivityDotMatrix";

    @PluginMethod
    public void setIcon(PluginCall call) {
        String icon = call.getString("icon", "void");
        PackageManager pm = getContext().getPackageManager();

        // Map icon id -> which component to enable
        String targetComponent;
        switch (icon) {
            case "lumen":        targetComponent = LUMEN;        break;
            case "neon-horizon": targetComponent = NEON_HORIZON; break;
            case "dot-matrix":   targetComponent = DOT_MATRIX;   break;
            default:             targetComponent = MAIN;          break;
        }

        String[] all = { MAIN, LUMEN, NEON_HORIZON, DOT_MATRIX };

        try {
            for (String component : all) {
                int state = component.equals(targetComponent)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

                // MAIN activity must never be fully disabled — use DEFAULT
                // so the system can still resolve it for deep links etc.
                if (component.equals(MAIN) && !component.equals(targetComponent)) {
                    state = PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                }

                pm.setComponentEnabledSetting(
                    new ComponentName(PKG, component),
                    state,
                    PackageManager.DONT_KILL_APP
                );
            }

            JSObject result = new JSObject();
            result.put("icon", icon);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to set icon: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();

        String active = "void"; // default
        try {
            int luState = pm.getComponentEnabledSetting(new ComponentName(PKG, LUMEN));
            int nhState = pm.getComponentEnabledSetting(new ComponentName(PKG, NEON_HORIZON));
            int dmState = pm.getComponentEnabledSetting(new ComponentName(PKG, DOT_MATRIX));

            if (luState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                active = "lumen";
            } else if (nhState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                active = "neon-horizon";
            } else if (dmState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                active = "dot-matrix";
            }
        } catch (Exception ignored) {}

        JSObject result = new JSObject();
        result.put("icon", active);
        call.resolve(result);
    }
}
