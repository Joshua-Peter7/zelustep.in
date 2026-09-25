import cron from 'node-cron';
import { getSupabase, isSupabaseConnected, localDb } from '../config/supabase.js';
import { sendTodoReminderEmail, sendEmergencyReminderEmail } from '../config/resend.js';
import { decryptField } from '../utils/crypto.js';

let isRunning = false;

export function initScheduler() {
  console.log('⏰ Initializing automated email reminder scheduler (runs every 30 seconds)...');

  // Check every 30 seconds: '*/30 * * * * *'
  cron.schedule('*/30 * * * * *', async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await checkTodoReminders();
      await checkEmergencyReminders();
    } catch (err) {
      console.error('Error in reminder scheduler cycle:', err.message);
    } finally {
      isRunning = false;
    }
  });
}

// -----------------------------------------------------------------------------
// CHECK TO-DO REMINDERS (Triggers when the task's due time closes in or ends)
// -----------------------------------------------------------------------------
async function checkTodoReminders() {
  const now = new Date();
  // Within 5 minutes from now, or already due, but not sent yet
  const windowForward = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  if (isSupabaseConnected()) {
    const supabase = getSupabase();
    try {
      const { data: pendingTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('email_sent', false)
        .eq('status', 'pending')
        .lte('due_time', windowForward);

      if (error) throw error;

      if (pendingTodos && pendingTodos.length > 0) {
        console.log(`⏰ Found ${pendingTodos.length} to-do reminder(s) ready to send.`);
        for (const todo of pendingTodos) {
          let recipientEmail = todo.user_email;
          if (!recipientEmail && todo.user_id) {
            try {
              const { data: userData } = await supabase.auth.admin.getUserById(todo.user_id);
              recipientEmail = userData?.user?.email;
            } catch (_) {}
          }
          recipientEmail = recipientEmail || process.env.DEFAULT_ALERT_EMAIL;

          const res = await sendTodoReminderEmail({
            to: recipientEmail,
            title: todo.title,
            description: todo.description,
            dueTime: todo.due_time,
            priority: todo.priority
          });

          if (res.success) {
            await supabase
              .from('todos')
              .update({ email_sent: true, updated_at: new Date().toISOString() })
              .eq('id', todo.id);
            console.log(`✅ To-Do reminder marked as sent for task "${todo.title}" (ID: ${todo.id})`);
          }
        }
      }
    } catch (err) {
      console.warn('Supabase checkTodoReminders note:', err.message);
    }
  }

  // Also check local store
  const localPending = localDb.collection('todos').find(todo => {
    if (todo.email_sent || todo.status === 'completed') return false;
    const dueTime = new Date(todo.due_time).getTime();
    return dueTime <= new Date(windowForward).getTime();
  });

  if (localPending.length > 0) {
    console.log(`⏰ [Local Storage] Found ${localPending.length} to-do reminder(s) ready to send.`);
    for (const todo of localPending) {
      const res = await sendTodoReminderEmail({
        to: todo.user_email || process.env.DEFAULT_ALERT_EMAIL,
        title: todo.title,
        description: todo.description,
        dueTime: todo.due_time,
        priority: todo.priority
      });

      if (res.success) {
        localDb.collection('todos').update(todo.id, { email_sent: true });
      }
    }
  }
}


// -----------------------------------------------------------------------------
// CHECK EMERGENCY REMINDERS (Triggers 1 HOUR before the event time)
// -----------------------------------------------------------------------------
async function checkEmergencyReminders() {
  const nowIso = new Date().toISOString();

  if (isSupabaseConnected()) {
    const supabase = getSupabase();
    // trigger_time is target_time - 1 hour.
    // If trigger_time <= now, and email_sent = false, fire reminder!
    const { data: emergencyList, error } = await supabase
      .from('emergency_reminders')
      .select('*')
      .eq('email_sent', false)
      .eq('is_dismissed', false)
      .lte('trigger_time', nowIso);

    if (error) {
      // Fall through to local store
    } else if (emergencyList && emergencyList.length > 0) {
      console.log(`🚨 Found ${emergencyList.length} 1-hour emergency reminder(s) to send.`);
      for (const item of emergencyList) {
        const res = await sendEmergencyReminderEmail({
          to: item.user_email,
          title: item.title,
          details: decryptField(item.details),
          targetTime: item.target_time,
          priority: item.priority
        });

        if (res.success) {
          await supabase
            .from('emergency_reminders')
            .update({ email_sent: true, updated_at: new Date().toISOString() })
            .eq('id', item.id);
        }
      }
    }
  } else {
    // Dynamic Local Store
    const emergencyList = localDb.collection('emergency_reminders').find(item => {
      if (item.email_sent || item.is_dismissed) return false;
      const triggerTime = new Date(item.trigger_time).getTime();
      return triggerTime <= Date.now();
    });

    if (emergencyList.length > 0) {
      console.log(`🚨 [Local Storage] Found ${emergencyList.length} 1-hour emergency reminder(s) to send.`);
      for (const item of emergencyList) {
        const res = await sendEmergencyReminderEmail({
          to: item.user_email,
          title: item.title,
          details: decryptField(item.details),
          targetTime: item.target_time,
          priority: item.priority
        });

        if (res.success) {
          localDb.collection('emergency_reminders').update(item.id, { email_sent: true });
        }
      }
    }
  }
}
