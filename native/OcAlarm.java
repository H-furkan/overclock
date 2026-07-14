package com.hfurkan.overclock;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// OVERCLOCK Plan C: gercek calar-saat sinifi alarm (setAlarmClock) — Doze, pil, SESSIZ MOD
// dahil hicbir sey susturamaz; saati gelince OcAlarmReceiver imza zilini ALARM kanalindan calar.
@CapacitorPlugin(name = "OcAlarm")
public class OcAlarm extends Plugin {

    private PendingIntent pi(Context c) {
        Intent i = new Intent(c, OcAlarmReceiver.class);
        return PendingIntent.getBroadcast(c, 4207, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            Double d = call.getDouble("at");
            long at = (d == null) ? 0L : (long)(double) d;
            Context c = getContext();
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            PendingIntent p = pi(c);
            am.cancel(p);
            if (at > System.currentTimeMillis()) {
                AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(at, p);
                am.setAlarmClock(info, p);
            }
            call.resolve();
        } catch (Exception e) { call.resolve(); }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            Context c = getContext();
            ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(pi(c));
        } catch (Exception e) {}
        call.resolve();
    }
}
