package com.siliba.app;

import android.os.Bundle;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            SwipeRefreshLayout swipeRefresh = findViewById(R.id.swipeRefresh);
            if (swipeRefresh != null) {
                swipeRefresh.setColorSchemeColors(0xFF008080);
                swipeRefresh.setOnRefreshListener(() -> {
                    try {
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            getBridge().getWebView().reload();
                        }
                    } catch (Exception e) {
                        // ignore
                    }
                    swipeRefresh.postDelayed(() -> swipeRefresh.setRefreshing(false), 1000);
                });
            }
        } catch (Exception e) {
            // SwipeRefresh not critical, app continues without it
        }
    }
}
