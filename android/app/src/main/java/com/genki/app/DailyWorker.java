package com.genki.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * DailyWorker — раз в день:
 *  1) одно новое слово + одна грамматика из базы Genki;
 *  2) если 2+ дня не заходил — напоминание «Рупа-чан».
 */
public class DailyWorker extends Worker {

    private static final String CH_DAILY = "souda_daily";
    private static final String CH_MISS  = "souda_miss";

    // Сообщения «Рупа-чан скучает» (трекер активности)
    private static final String[] MISS = {
        "ルパちゃんが寂しがってるよ… 🥺 (Рупа-чан скучает по тебе)",
        "ルパちゃん、勉強しないと泣いちゃう… 😢 (Рупа-чан плачет, когда ты не занимаешься)",
        "おかえり！ルパちゃんが待ってるよ (Возвращайся, Рупа-чан ждёт!)",
        "今日も一緒に頑張ろう？ルパちゃんより (Позанимаемся вместе? — Рупа-чан)",
        "ちょっとだけでも復習しない？ ルパちゃんが応援してる！"
    };

    public DailyWorker(@NonNull Context c, @NonNull WorkerParameters p){ super(c,p); }

    @NonNull @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        createChannels(ctx);

        // 1) ежедневное слово + грамматика
        try {
            JSONObject data = loadData(ctx);
            if (data != null) {
                JSONArray vocab = data.getJSONArray("vocab");
                JSONArray gram  = data.getJSONArray("grammar");
                JSONObject w = vocab.getJSONObject((int)(Math.random()*vocab.length()));
                JSONObject g = gram.getJSONObject((int)(Math.random()*gram.length()));
                String jp = w.optString("j"); if (jp.isEmpty()) jp = w.optString("k");
                String word = jp + "（" + w.optString("k") + "）— " + w.optString("r");
                String grammar = g.optString("t") + " — " + g.optString("m");
                notify(ctx, CH_DAILY, 101, "今日の一言 · そうです",
                        "新しい言葉: " + word + "\n文法: " + grammar);
            }
        } catch (Exception ignored) {}

        // 2) трекер активности
        SharedPreferences p = ctx.getSharedPreferences("souda", Context.MODE_PRIVATE);
        long last = p.getLong("lastOpen", System.currentTimeMillis());
        long days = (System.currentTimeMillis() - last) / 86400000L;
        if (days >= 2) {
            String msg = MISS[(int)(Math.random()*MISS.length)];
            notify(ctx, CH_MISS, 102, "ルパちゃん", msg);
        }
        return Result.success();
    }

    private JSONObject loadData(Context ctx){
        try {
            InputStream is = ctx.getAssets().open("js/data.js");
            BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            String s = sb.toString();
            int a = s.indexOf('{'); int b = s.lastIndexOf('}');
            if (a < 0 || b < 0) return null;
            return new JSONObject(s.substring(a, b + 1));
        } catch (Exception e){ return null; }
    }

    private void createChannels(Context ctx){
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel(CH_DAILY, "Ежедневное слово", NotificationManager.IMPORTANCE_DEFAULT));
            nm.createNotificationChannel(new NotificationChannel(CH_MISS, "Напоминания", NotificationManager.IMPORTANCE_DEFAULT));
        }
    }

    private void notify(Context ctx, String channel, int id, String title, String text){
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true);
        try { NotificationManagerCompat.from(ctx).notify(id, b.build()); } catch (SecurityException ignored) {}
    }
}
