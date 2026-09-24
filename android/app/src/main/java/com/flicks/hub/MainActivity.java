package com.flicks.hub;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private AndroidShareBridge shareBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            shareBridge = new AndroidShareBridge(this);
            webView.addJavascriptInterface(shareBridge, "AndroidShare");
            webView.setVerticalScrollBarEnabled(true);
            webView.setHorizontalScrollBarEnabled(false);
        }
    }

    @Override
    protected void onDestroy() {
        if (shareBridge != null) {
            shareBridge.shutdown();
        }
        super.onDestroy();
    }
}
