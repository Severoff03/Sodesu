package com.genki.app;

import android.app.ProgressDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Foreground GitHub checks; only verified same-channel APKs reach the system installer. */
final class AppUpdater {
    private static final String REPO = "Severoff03/Sodesu";
    private static final long INTERVAL = 6 * 60 * 60 * 1000L;
    private static final long MAX_APK = 250 * 1024 * 1024L;
    private final MainActivity activity;
    private final boolean debug;
    private final SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean busy, destroyed, foreground, prompting;
    private File pendingFile;
    private Candidate pendingCandidate;
    private String offered = "";
    private AlertDialog offerDialog;
    private ProgressDialog downloadDialog;
    private final Runnable tick = new Runnable() {
        @Override public void run() { check(false); if (foreground) ui.postDelayed(this, 60 * 60 * 1000L); }
    };

    AppUpdater(MainActivity activity) {
        this.activity = activity;
        debug = (activity.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        prefs = activity.getSharedPreferences("github_updates", 0);
    }

    String channelName() { return debug ? "Early Access" : "Release"; }

    void resume() {
        foreground = true;
        ui.removeCallbacks(tick);
        if (pendingFile != null && (Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls())) {
            File file = pendingFile; Candidate candidate = pendingCandidate;
            pendingFile = null; pendingCandidate = null;
            install(file, candidate);
        }
        ui.postDelayed(tick, 3000);
    }

    void pause() { foreground = false; ui.removeCallbacks(tick); }
    void destroy() {
        destroyed = true; pause(); worker.shutdownNow();
        if (offerDialog != null) offerDialog.dismiss();
        if (downloadDialog != null) downloadDialog.dismiss();
    }
    private boolean alive() { return !destroyed && !activity.isFinishing() && !activity.isDestroyed(); }
    private void message(String text) { if (alive()) Toast.makeText(activity, text, Toast.LENGTH_LONG).show(); }

    void check(boolean manual) {
        if (!alive() || busy || prompting) { if (manual) message("Проверка или загрузка уже выполняется"); return; }
        long now = System.currentTimeMillis();
        if (now < prefs.getLong("retryAfter", 0)) {
            if (manual) message("GitHub временно ограничил запросы. Повторите позже");
            return;
        }
        long last = prefs.getLong("attempt", 0);
        long delay = manual ? 60000 : prefs.getLong("delay", INTERVAL);
        if (now >= last && now - last < delay) {
            if (manual) message("Проверка уже выполнялась. Повторите через минуту");
            return;
        }
        prefs.edit().putLong("attempt", now).apply();
        busy = true;
        if (manual) message("Проверяем обновления · " + channelName());
        worker.execute(() -> {
            try {
                Candidate candidate = latest();
                prefs.edit().putLong("delay", INTERVAL).apply();
                ui.post(() -> {
                    busy = false;
                    if (!alive()) return;
                    if (candidate == null) { if (manual) message("Обновлений для «" + channelName() + "» нет"); }
                    else if (manual || !candidate.tag.equals(offered)) {
                        if (foreground) offer(candidate);
                    }
                });
            } catch (Exception error) {
                // Failed attempts back off too, including GitHub rate limits.
                ui.post(() -> { busy = false; if (manual) message("Не удалось проверить обновления. Проверьте интернет и повторите позже"); });
            }
        });
    }

    private Candidate latest() throws Exception {
        Candidate best = null;
        String installed = activity.getString(R.string.app_version);
        for (int page = 1; page <= 3; page++) {
            JSONArray releases = new JSONArray(readJson("https://api.github.com/repos/" + REPO + "/releases?per_page=100&page=" + page));
            for (int i = 0; i < releases.length(); i++) {
                JSONObject release = releases.getJSONObject(i);
                String tag = release.optString("tag_name");
                if (!UpdatePolicy.channel(debug, release.optBoolean("draft"), release.optBoolean("prerelease"), tag)) continue;
                String version = UpdatePolicy.version(tag);
                if (UpdatePolicy.compare(version, installed) <= 0 || (best != null && UpdatePolicy.compare(version, best.version) <= 0)) continue;
                JSONArray assets = release.optJSONArray("assets");
                if (assets == null) continue;
                for (int j = 0; j < assets.length(); j++) {
                    JSONObject asset = assets.getJSONObject(j);
                    String name = asset.optString("name"), digest = asset.optString("digest");
                    long size = asset.optLong("size");
                    String url = asset.optString("browser_download_url");
                    if (UpdatePolicy.asset(debug, version, name) && UpdatePolicy.digest(digest)
                            && "uploaded".equals(asset.optString("state")) && size > 0 && size <= MAX_APK
                            && url.equals("https://github.com/" + REPO + "/releases/download/" + tag + "/" + name)) {
                        best = new Candidate(tag, version, url, digest.substring(7), size);
                    }
                }
            }
            if (releases.length() < 100) break;
        }
        return best;
    }

    private void offer(Candidate candidate) {
        offered = candidate.tag;
        prompting = true;
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("Доступно обновление")
                .setMessage("Sodesu " + candidate.version + " · " + channelName() + "\nСкачать APK ("
                        + (candidate.size / 1024 / 1024 + 1) + " МБ)? Установку подтвердит Android.")
                .setNegativeButton("Позже", (d, w) -> {})
                .setPositiveButton("Скачать", (d, w) -> download(candidate)).create();
        dialog.setOnDismissListener(d -> prompting = false);
        offerDialog = dialog;
        dialog.show();
    }

    @SuppressWarnings("deprecation")
    private void download(Candidate candidate) {
        if (busy || !alive()) return;
        busy = true;
        AtomicBoolean cancelled = new AtomicBoolean(false);
        ProgressDialog progress = new ProgressDialog(activity);
        downloadDialog = progress;
        progress.setTitle("Скачивание обновления · " + channelName());
        progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        progress.setMax(100);
        progress.setCancelable(true);
        progress.setOnCancelListener(d -> cancelled.set(true));
        progress.show();
        worker.execute(() -> {
            File file = new File(activity.getCacheDir(), "updates/update.apk");
            try {
                File folder = file.getParentFile();
                if (folder == null || (!folder.isDirectory() && !folder.mkdirs())) throw new IOException("Cache unavailable");
                HttpURLConnection connection = open(candidate.url);
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(file)) {
                    long count = 0; int n, percent = -1;
                    byte[] buffer = new byte[32768];
                    while ((n = input.read(buffer)) != -1) {
                        if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
                        count += n;
                        if (count > candidate.size) throw new IOException("Unexpected APK size");
                        output.write(buffer, 0, n);
                        int value = (int)(100 * count / candidate.size);
                        if (value != percent) { percent = value; ui.post(() -> { if (alive()) progress.setProgress(value); }); }
                    }
                    if (count != candidate.size) throw new IOException("Incomplete APK");
                } finally { connection.disconnect(); }
                verify(file, candidate);
                ui.post(() -> {
                    busy = false;
                    if (alive()) progress.dismiss();
                    if (!cancelled.get() && alive()) install(file, candidate); else file.delete();
                });
            } catch (Exception error) {
                file.delete();
                ui.post(() -> { busy = false; if (alive()) progress.dismiss(); if (!cancelled.get()) message("Обновление не прошло проверку или не скачалось. Повторите позже"); });
            }
        });
    }

    @SuppressWarnings("deprecation")
    private void verify(File file, Candidate candidate) throws Exception {
        if (file.length() != candidate.size) throw new IOException("Unexpected APK size");
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int n;
            while ((n = input.read(buffer)) != -1) sha.update(buffer, 0, n);
        }
        StringBuilder digest = new StringBuilder();
        for (byte b : sha.digest()) digest.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        if (!candidate.sha256.equalsIgnoreCase(digest.toString())) throw new IOException("APK checksum mismatch");
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        if (archive == null || archive.applicationInfo == null || !installed.packageName.equals(archive.packageName)) throw new IOException("Wrong package");
        long installedCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        long archiveCode = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        boolean archiveDebug = (archive.applicationInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!UpdatePolicy.newerApk(candidate.version, archive.versionName, installedCode, archiveCode, debug, archiveDebug)) throw new IOException("Wrong APK version or channel");
        if (!signers(installed).equals(signers(archive)) || signers(installed).isEmpty()) throw new IOException("Different APK signer");
    }

    @SuppressWarnings("deprecation")
    private Set<String> signers(PackageInfo info) {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null
                ? info.signingInfo.getApkContentsSigners() : info.signatures;
        Set<String> values = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures) values.add(signature.toCharsString());
        return values;
    }

    private void install(File file, Candidate candidate) {
        if (!alive() || busy) return;
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            pendingFile = file; pendingCandidate = candidate;
            new AlertDialog.Builder(activity).setTitle("Разрешить установку обновления")
                    .setMessage("Разрешите Sodesu устанавливать приложения. После возвращения откроется установщик Android.")
                    .setNegativeButton("Позже", (d, w) -> { pendingFile = null; pendingCandidate = null; })
                    .setPositiveButton("Открыть настройки", (d, w) -> {
                        try { activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); }
                        catch (Exception error) { pendingFile = null; pendingCandidate = null; message("Откройте разрешение установки приложений в настройках Android"); }
                    }).show();
            return;
        }
        busy = true;
        worker.execute(() -> {
            try {
                verify(file, candidate);
                ui.post(() -> {
                    busy = false;
                    if (!alive()) return;
                    try {
                        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", file);
                        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        activity.startActivity(intent);
                    } catch (Exception error) { message("Не удалось открыть установщик Android"); }
                });
            } catch (Exception error) { file.delete(); ui.post(() -> { busy = false; message("APK не прошёл проверку"); }); }
        });
    }

    private String readJson(String url) throws Exception {
        HttpURLConnection connection = open(url);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int n;
            while ((n = input.read(buffer)) != -1) {
                if (output.size() + n > 8 * 1024 * 1024) throw new IOException("Response too large");
                output.write(buffer, 0, n);
            }
            return output.toString("UTF-8");
        } finally { connection.disconnect(); }
    }

    private HttpURLConnection open(String address) throws Exception {
        URL url = new URL(address);
        for (int redirects = 0; redirects < 6; redirects++) {
            String host = url.getHost();
            if (!"https".equals(url.getProtocol()) || !(host.equals("api.github.com") || host.equals("github.com")
                    || host.equals("release-assets.githubusercontent.com") || host.equals("objects.githubusercontent.com"))) throw new IOException("Untrusted download URL");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "Sodesu-Updater");
            connection.setRequestProperty("Accept", host.equals("api.github.com") ? "application/vnd.github+json" : "application/octet-stream");
            int code = connection.getResponseCode();
            if (code >= 300 && code <= 399) {
                String location = connection.getHeaderField("Location"); connection.disconnect();
                if (location == null) throw new IOException("Missing redirect");
                url = new URL(url, location); continue;
            }
            if (code != 200) {
                if (code == 403 || code == 429) {
                    long wait = System.currentTimeMillis() + 60 * 60 * 1000L;
                    try { wait = Math.max(wait, Long.parseLong(connection.getHeaderField("X-RateLimit-Reset")) * 1000L); } catch (Exception ignored) {}
                    try { wait = Math.max(wait, System.currentTimeMillis() + Long.parseLong(connection.getHeaderField("Retry-After")) * 1000L); } catch (Exception ignored) {}
                    prefs.edit().putLong("retryAfter", wait).apply();
                }
                connection.disconnect(); throw new IOException("HTTP " + code);
            }
            return connection;
        }
        throw new IOException("Too many redirects");
    }

    private static final class Candidate {
        final String tag, version, url, sha256; final long size;
        Candidate(String tag, String version, String url, String sha256, long size) {
            this.tag = tag; this.version = version; this.url = url; this.sha256 = sha256; this.size = size;
        }
    }
}
