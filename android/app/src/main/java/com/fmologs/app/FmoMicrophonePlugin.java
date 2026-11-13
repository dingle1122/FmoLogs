package com.fmologs.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.util.Base64;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

@CapacitorPlugin(name = "FmoMicrophone")
public class FmoMicrophonePlugin extends Plugin {
    private static final int SAMPLE_RATE = 16000;
    // 减少 Capacitor 事件频率，避免 Android WebView 桥在连续采集时积压。
    private static final int BUFFER_SAMPLES = 8192;
    private AudioRecord recorder;
    private Thread captureThread;
    private volatile boolean running;
    private long offset;

    @PluginMethod
    public void listDevices(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("RECORD_AUDIO permission is required");
            return;
        }
        JSArray devices = new JSArray();
        AudioManager manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            for (AudioDeviceInfo device : manager.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
                JSObject item = new JSObject();
                item.put("deviceId", String.valueOf(device.getId()));
                item.put("label", device.getProductName());
                item.put("type", deviceTypeName(device.getType()));
                devices.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    private String deviceTypeName(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_MIC: return "手机内置";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO: return "蓝牙耳机";
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_USB_HEADSET: return "USB 音频设备";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET: return "有线耳机";
            case AudioDeviceInfo.TYPE_TELEPHONY: return "通话输入";
            default: return "其他输入设备";
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("RECORD_AUDIO permission is required");
            return;
        }
        stopCapture();
        int min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) { call.reject("AudioRecord is unavailable"); return; }
        try {
            recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(min, BUFFER_SAMPLES * 2) * 2);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String id = call.getString("deviceId");
                if (id != null && !id.isEmpty()) {
                    AudioManager manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                    if (manager != null) for (AudioDeviceInfo device : manager.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
                        if (id.equals(String.valueOf(device.getId()))) { recorder.setPreferredDevice(device); break; }
                    }
                }
            }
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("AudioRecord did not start");
            running = true; offset = 0;
            captureThread = new Thread(this::captureLoop, "FmoMicrophoneCapture");
            captureThread.start();
            call.resolve();
        } catch (Exception e) { stopCapture(); call.reject(e.getMessage() == null ? "Could not start audio source" : e.getMessage()); }
    }

    private void captureLoop() {
        short[] samples = new short[BUFFER_SAMPLES];
        while (running && recorder != null) {
            int count = recorder.read(samples, 0, samples.length);
            if (count <= 0) continue;
            ByteBuffer bytes = ByteBuffer.allocate(count * 2).order(ByteOrder.LITTLE_ENDIAN);
            for (int i = 0; i < count; i++) bytes.putShort(samples[i]);
            JSObject payload = new JSObject();
            payload.put("data", Base64.encodeToString(bytes.array(), Base64.NO_WRAP));
            payload.put("sampleRate", SAMPLE_RATE);
            payload.put("generation", 1);
            payload.put("sampleOffset", offset);
            offset += count;
            notifyListeners("pcm", payload);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) { stopCapture(); call.resolve(); }

    private synchronized void stopCapture() {
        running = false;
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            recorder.release();
            recorder = null;
        }
        captureThread = null;
    }

    @Override
    protected void handleOnDestroy() { stopCapture(); super.handleOnDestroy(); }
}
