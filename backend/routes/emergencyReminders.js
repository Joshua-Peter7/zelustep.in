import express from 'express';
import { getSupabase, isSupabaseConnected, isValidUUID, localDb } from '../config/supabase.js';
import { sendEmergencyReminderEmail } from '../config/resend.js';
import { authenticateUser } from './auth.js';
import { encryptField, decryptField } from '../utils/crypto.js';

const router = express.Router();
router.use(authenticateUser);

// GET /api/emergency-reminders - List emergency reminders
router.get('/', async (req, res) => {
  const userId = req.user.id;

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('emergency_reminders')
        .select('*')
        .eq('user_id', userId)
        .order('target_time', { ascending: true });

      if (!error && data) {
        const decryptedList = data.map(r => ({
          ...r,
          details: decryptField(r.details)
        }));
        return res.json(decryptedList);
      }
    } catch (err) {
      console.warn('Supabase GET emergency_reminders note (falling back to local storage):', err.message);
    }
  }

  const list = localDb.collection('emergency_reminders').find(x => x.user_id === userId);
  list.sort((a, b) => new Date(a.target_time) - new Date(b.target_time));
  const decryptedList = list.map(r => ({
    ...r,
    details: decryptField(r.details)
  }));
  return res.json(decryptedList);
});

// POST /api/emergency-reminders - Create emergency reminder
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.body.userEmail || req.user.email;
  const { title, details, targetTime, priority } = req.body;

  if (!title || !details || !targetTime) {
    return res.status(400).json({ error: 'Title, reminder details, and target time are required' });
  }

  const targetDateObj = new Date(targetTime);
  // Calculate trigger time: exactly 1 hour before the scheduled time
  const triggerDateObj = new Date(targetDateObj.getTime() - 60 * 60 * 1000);

  const encryptedDetails = encryptField(details.trim());

  const newReminder = {
    user_id: userId,
    title: title.trim(),
    details: encryptedDetails,
    target_time: targetDateObj.toISOString(),
    trigger_time: triggerDateObj.toISOString(),
    email_sent: false,
    user_email: userEmail,
    priority: priority || 'emergency',
    is_dismissed: false
  };

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('emergency_reminders')
        .insert([newReminder])
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({
          ...data,
          details: decryptField(data.details)
        });
      }
    } catch (err) {
      console.warn('Supabase POST emergency_reminder note (falling back to local storage):', err.message);
    }
  }

  const created = localDb.collection('emergency_reminders').insert(newReminder);
  return res.status(201).json({
    ...created,
    details: decryptField(created.details)
  });
});

// PUT /api/emergency-reminders/:id/dismiss
router.put('/:id/dismiss', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('emergency_reminders')
        .update({ is_dismissed: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({
        ...data,
        details: decryptField(data?.details)
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const updated = localDb.collection('emergency_reminders').update(id, { is_dismissed: true });
  return res.json({
    ...updated,
    details: decryptField(updated?.details)
  });
});

// DELETE /api/emergency-reminders/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('emergency_reminders').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  localDb.collection('emergency_reminders').delete(id);
  return res.json({ success: true });
});

// POST /api/emergency-reminders/:id/test-email - Immediate manual test send
router.post('/:id/test-email', async (req, res) => {
  const { id } = req.params;

  let reminder = null;
  if (isSupabaseConnected()) {
    const supabase = getSupabase();
    const { data } = await supabase.from('emergency_reminders').select('*').eq('id', id).single();
    reminder = data;
  } else {
    reminder = localDb.collection('emergency_reminders').findOne(x => x.id === id);
  }

  if (!reminder) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  const result = await sendEmergencyReminderEmail({
    to: reminder.user_email || req.user.email,
    title: reminder.title,
    details: decryptField(reminder.details),
    targetTime: reminder.target_time,
    priority: reminder.priority
  });

  return res.json(result);
});

export default router;
