package app.ludodex.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlternateIconPlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge: WebView draws behind the status bar.
        // JS (StatusBar plugin) will update icon color when skins change,
        // but we set the baseline here before the bridge starts so the
        // very first frame is already correct.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        // false = light (white) icons — correct for the default dark Void skin.
        controller.setAppearanceLightStatusBars(false);
    }
}
