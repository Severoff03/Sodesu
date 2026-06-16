package com.genki.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * MainActivity — оболочка WebView для приложения そうです.
 * + мост JS->native для трекинга активности
 * + ежедневный воркер (новое слово/грамматика + напоминание Рупа-чан).
 */
public class MainActivity extends AppCompatActivity {

    private WebView web;

    @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF0B0E1A);
        web.addJavascriptInterface(new Bridge(this), "Android");
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        web.loadUrl("file:///android_asset/index.html");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else { setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); }
            }
        });

        markActive();
        requestNotifPermission();
        scheduleDaily();
    }

    /** Мост: JS вызывает window.Android.setActive() при открытии. */
    public static class Bridge {
        private final Context ctx;
        Bridge(Context c){ ctx = c; }
        @JavascriptInterface public void setActive(){ markActiveStatic(ctx); }
    }

    private void markActive(){ markActiveStatic(this); }
    static void markActiveStatic(Context ctx){
        SharedPreferences p = ctx.getSharedPreferences("souda", Context.MODE_PRIVATE);
        p.edit().putLong("lastOpen", System.currentTimeMillis()).apply();
    }

    private void requestNotifPermission(){
        if (Build.VERSION.SDK_INT >= 33) {
            try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1); } catch (Exception ignored) {}
        }
    }

    /** Ежедневный воркер ~ на 10:00. */
    private void scheduleDaily(){
        Calendar now = Calendar.getInstance();
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, 10);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        if (next.before(now)) next.add(Calendar.DATE, 1);
        long delay = next.getTimeInMillis() - now.getTimeInMillis();

        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(DailyWorker.class, 1, TimeUnit.DAYS)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "souda_daily", ExistingPeriodicWorkPolicy.UPDATE, req);
    }
}
