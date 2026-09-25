import express from 'express';
import { getSupabase, isSupabaseConnected, isValidUUID, localDb } from '../config/supabase.js';
import { sendTodoReminderEmail } from '../config/resend.js';
import { authenticateUser } from './auth.js';

const router = express.Router();
router.use(authenticateUser);

// GET /api/todos - List all todos for current user
router.get('/', async (req, res) => {
  const userId = req.user.id;

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .order('due_time', { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.warn('Supabase GET todos note (falling back to local storage):', err.message);
      // Fall through to local store
    }
  }

  // Local store
  const items = localDb.collection('todos').find(t => t.user_id === userId);
  items.sort((a, b) => new Date(a.due_time) - new Date(b.due_time));
  return res.json(items);
});

// POST /api/todos - Create a new daily task with reminder time
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.body.userEmail || req.user.email;
  const { title, description, dueTime, priority } = req.body;

  if (!title || !dueTime) {
    return res.status(400).json({ error: 'Title and due time are required' });
  }

  const newTodo = {
    user_id: userId,
    title: title.trim(),
    description: description ? description.trim() : '',
    due_time: new Date(dueTime).toISOString(),
    priority: priority || 'medium',
    status: 'pending',
    email_sent: false,
    user_email: userEmail
  };

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('todos')
        .insert([newTodo])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.warn('Supabase INSERT todo note (falling back to local storage):', err.message);
      // Fall through to local store
    }
  }

  const created = localDb.collection('todos').insert(newTodo);
  return res.status(201).json(created);
});

// PUT /api/todos/:id - Update or toggle status
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('todos')
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

  const updated = localDb.collection('todos').update(id, updates);
  if (!updated) return res.status(404).json({ error: 'Todo not found' });
  return res.json(updated);
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Todo deleted' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  localDb.collection('todos').delete(id);
  return res.json({ success: true, message: 'Todo deleted' });
});

// POST /api/todos/:id/test-email - Trigger reminder email immediately
router.post('/:id/test-email', async (req, res) => {
  const { id } = req.params;

  let todo = null;
  if (isSupabaseConnected()) {
    const supabase = getSupabase();
    const { data } = await supabase.from('todos').select('*').eq('id', id).single();
    todo = data;
  } else {
    todo = localDb.collection('todos').findOne(t => t.id === id);
  }

  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  const result = await sendTodoReminderEmail({
    to: todo.user_email || req.user.email,
    title: todo.title,
    description: todo.description,
    dueTime: todo.due_time,
    priority: todo.priority
  });

  return res.json(result);
});

export default router;
