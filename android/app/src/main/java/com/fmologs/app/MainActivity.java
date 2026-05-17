package com.fmologs.app;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FmoAudioPlugin.class);
        registerPlugin(FmoEventsPlugin.class);
        registerPlugin(FmoAprsPlugin.class);
        registerPlugin(FmoGridPlugin.class);
        registerPlugin(FmoSystemUiPlugin.class);
        registerPlugin(FmoLocationPlugin.class);
        super.onCreate(savedInstanceState);

        // Keep H5 text metrics stable across OEM WebView variants such as foldables.
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings webSettings = getBridge().getWebView().getSettings();
            webSettings.setTextZoom(100);
        }
    }
}
