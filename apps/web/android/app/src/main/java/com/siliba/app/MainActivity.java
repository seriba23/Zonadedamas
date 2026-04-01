package com.siliba.app;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SwipeRefreshLayout swipeRefresh = findViewById(R.id.swipeRefresh);
        if (swipeRefresh != null) {
            // Teal color for the refresh spinner
            swipeRefresh.setColorSchemeColors(0xFF008080);

            swipeRefresh.setOnRefreshListener(() -> {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.reload();
                }
                // Hide spinner after a short delay
                swipeRefresh.postDelayed(() -> swipeRefresh.setRefreshing(false), 1000);
            });
        }
    }
}
