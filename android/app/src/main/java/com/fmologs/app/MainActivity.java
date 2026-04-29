package com.fmologs.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FmoAudioPlugin.class);
        registerPlugin(FmoEventsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
