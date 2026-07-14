package com.hfurkan.overclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.PowerManager;

// Saati gelince imza zilini (res/raw/oc_bell) ALARM ses kanalindan calar.
public class OcAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            final PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "oc:alarmbell");
            wl.acquire(15000);
            int res = c.getResources().getIdentifier("oc_bell", "raw", c.getPackageName());
            if (res == 0) { try { wl.release(); } catch (Exception e) {} return; }
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            MediaPlayer mp = MediaPlayer.create(c, res, attrs, am.generateAudioSessionId());
            if (mp != null) {
                mp.setOnCompletionListener(m -> { m.release(); try { wl.release(); } catch (Exception e) {} });
                mp.start();
            } else { try { wl.release(); } catch (Exception e) {} }
        } catch (Exception e) {}
    }
}
