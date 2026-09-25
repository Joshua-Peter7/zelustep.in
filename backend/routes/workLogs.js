import express from 'express';
import { getSupabase, isSupabaseConnected, isValidUUID, localDb } from '../config/supabase.js';
import { authenticateUser } from './auth.js';

const router = express.Router();
router.use(authenticateUser);

// GET /api/work-logs - Filter by date (e.g. ?date=2026-09-25)
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('log_date', targetDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.warn('Supabase GET work_logs note (falling back to local storage):', err.message);
    }
  }

  // Local store
  const logs = localDb.collection('work_logs').find(item => {
    return item.user_id === userId && item.log_date === targetDate;
  });
  logs.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  return res.json(logs);
});

// GET /api/work-logs/range - Date range breakdown for weekly bar chart
router.get('/range', async (req, res) => {
  const userId = req.user.id;
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end dates are required' });
  }

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('work_logs')
        .select('log_date, hours_spent, title, category, status')
        .eq('user_id', userId)
        .gte('log_date', start)
        .lte('log_date', end);

      if (error) throw error;

      const dateMap = {};
      (data || []).forEach(log => {
        if (!dateMap[log.log_date]) {
          dateMap[log.log_date] = { count: 0, totalHours: 0, items: [] };
        }
        dateMap[log.log_date].count += 1;
        dateMap[log.log_date].totalHours += Number(log.hours_spent || 0);
        dateMap[log.log_date].items.push(log);
      });

      return res.json(dateMap);
    } catch (err) {
      console.warn('Supabase range note (falling back to local storage):', err.message);
    }
  }

  const logs = localDb.collection('work_logs').find(item => {
    return item.user_id === userId && item.log_date >= start && item.log_date <= end;
  });

  const dateMap = {};
  logs.forEach(log => {
    if (!dateMap[log.log_date]) {
      dateMap[log.log_date] = { count: 0, totalHours: 0, items: [] };
    }
    dateMap[log.log_date].count += 1;
    dateMap[log.log_date].totalHours += Number(log.hours_spent || 0);
    dateMap[log.log_date].items.push(log);
  });

  return res.json(dateMap);
});

// GET /api/work-logs/calendar-dates - Monthly breakdown for calendar days highlighting
router.get('/calendar-dates', async (req, res) => {

  const userId = req.user.id;
  const monthPrefix = req.query.month || new Date().toISOString().slice(0, 7); // e.g. "2026-09"

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const [y, m] = monthPrefix.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const lastDateStr = `${monthPrefix}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('work_logs')
        .select('log_date, hours_spent, title, category')
        .eq('user_id', userId)
        .gte('log_date', `${monthPrefix}-01`)
        .lte('log_date', lastDateStr);

      if (error) throw error;

      // Group by date
      const dateMap = {};
      (data || []).forEach(log => {
        if (!dateMap[log.log_date]) {
          dateMap[log.log_date] = { count: 0, totalHours: 0, items: [] };
        }
        dateMap[log.log_date].count += 1;
        dateMap[log.log_date].totalHours += Number(log.hours_spent || 0);
        dateMap[log.log_date].items.push(log.title);
      });

      return res.json(dateMap);
    } catch (err) {
      console.warn('Supabase calendar-dates note (falling back to local storage):', err.message);
    }
  }

  // Local store
  const logs = localDb.collection('work_logs').find(item => {
    return item.user_id === userId && item.log_date && item.log_date.startsWith(monthPrefix);
  });

  const dateMap = {};
  logs.forEach(log => {
    if (!dateMap[log.log_date]) {
      dateMap[log.log_date] = { count: 0, totalHours: 0, items: [] };
    }
    dateMap[log.log_date].count += 1;
    dateMap[log.log_date].totalHours += Number(log.hours_spent || 0);
    dateMap[log.log_date].items.push(log.title);
  });

  return res.json(dateMap);
});

// POST /api/work-logs - Add work log entry
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { log_date, start_time, end_time, title, work_done, hours_spent, category, status } = req.body;

  if (!log_date || !title || !work_done) {
    return res.status(400).json({ error: 'Date, title, and work done are required' });
  }

  const newLog = {
    user_id: userId,
    log_date,
    start_time: start_time || null,
    end_time: end_time || null,
    title: title.trim(),
    work_done: work_done.trim(),
    hours_spent: Number(hours_spent) || 1.0,
    category: category || 'General',
    status: status || 'completed'
  };

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('work_logs')
        .insert([newLog])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.warn('Supabase POST work_log note (falling back to local storage):', err.message);
    }
  }

  const created = localDb.collection('work_logs').insert(newLog);
  return res.status(201).json(created);
});

// PUT /api/work-logs/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('work_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const updated = localDb.collection('work_logs').update(id, updates);
  if (!updated) return res.status(404).json({ error: 'Work log entry not found' });
  return res.json(updated);
});

// DELETE /api/work-logs/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('work_logs').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Work entry deleted' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  localDb.collection('work_logs').delete(id);
  return res.json({ success: true, message: 'Work entry deleted' });
});

export default router;
