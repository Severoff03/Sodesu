package com.genki.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * MainActivity — оболочка WebView для приложения そうです.
 * + мост JS->native для трекинга активности
 * + ежедневный воркер (новое слово/грамматика + напоминание Рупа-чан).
 */
public class MainActivity extends AppCompatActivity {

    private WebView web;

    // Содержимое файла, ожидающее выбора места сохранения (Storage Access Framework).
    private String pendingContent = null;
    private String pendingMime = "application/octet-stream";
    private ActivityResultLauncher<Intent> createDocLauncher;
    // Выбор файла для <input type="file"> (восстановление прогресса, импорт .csv).
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        createDocLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null
                            && result.getData().getData() != null && pendingContent != null) {
                        writeToUri(result.getData().getData(), pendingContent);
                    }
                    pendingContent = null;
                });

        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback == null) return;
                    Uri[] uris = null;
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        Uri d = result.getData().getData();
                        if (d != null) uris = new Uri[]{ d };
                    }
                    filePathCallback.onReceiveValue(uris);
                    filePathCallback = null;
                });

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) { filePathCallback.onReceiveValue(null); }
                filePathCallback = cb;
                try {
                    // Показываем все файлы: .csv/.json часто помечены как octet-stream/text-plain
                    // и при фильтре по MIME становятся «серыми» (невыбираемыми).
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    fileChooserLauncher.launch(Intent.createChooser(i, "Выберите файл"));
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Не удалось открыть выбор файла", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
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
        private final MainActivity act;
        Bridge(MainActivity a){ ctx = a; act = a; }
        @JavascriptInterface public void setActive(){ markActiveStatic(ctx); }
        /** Сохранить файл с выбором места (диалог системы). */
        @JavascriptInterface public void saveFile(String content, String filename, String mime){
            act.startSaveFile(content, filename, mime);
        }
        /** Открыть ссылку во внешнем браузере. */
        @JavascriptInterface public void openUrl(String url){
            act.openExternal(url);
        }
    }

    void openExternal(String url){
        if (url == null || url.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) {
                Toast.makeText(this, "Не удалось открыть ссылку", Toast.LENGTH_SHORT).show();
            }
        });
    }

    /** Запуск системного диалога «создать документ» с предложенным именем. */
    void startSaveFile(String content, String filename, String mime){
        pendingContent = content != null ? content : "";
        pendingMime = (mime != null && !mime.isEmpty()) ? mime : "application/octet-stream";
        runOnUiThread(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(pendingMime);
                i.putExtra(Intent.EXTRA_TITLE, filename != null ? filename : "file");
                createDocLauncher.launch(i);
            } catch (Exception e) {
                pendingContent = null;
                Toast.makeText(this, "Не удалось открыть диалог сохранения", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void writeToUri(Uri uri, String content){
        try (OutputStream os = getContentResolver().openOutputStream(uri, "w")) {
            if (os != null) {
                os.write(content.getBytes(StandardCharsets.UTF_8));
                os.flush();
                Toast.makeText(this, "Файл сохранён", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Ошибка записи файла", Toast.LENGTH_SHORT).show();
        }
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

    /** Ежедневные уведомления отключены: отменяем воркер (в т.ч. на уже установленных). */
    private void scheduleDaily(){
        try { WorkManager.getInstance(this).cancelUniqueWork("souda_daily"); } catch (Exception ignored) {}
    }
}
