import express from 'express';
import bcrypt from 'bcrypt';
import { getSupabase, isSupabaseConnected, localDb } from '../config/supabase.js';
import { getResendClient } from '../config/resend.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin'));

// GET /api/admin/users - List all registered users with their metrics and credentials
router.get('/users', async (req, res) => {
  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const [{ data: authData, error: authError }, { data: profiles, error: profError }] = await Promise.all([
        supabase.auth.admin.listUsers(),
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
      ]);

      if (authError && profError) throw (authError || profError);

      const authUsers = authData?.users || [];
      const profileList = profiles || [];

      // Get count aggregates
      const [todos, work, finances] = await Promise.all([
        supabase.from('todos').select('id, user_id'),
        supabase.from('work_logs').select('id, user_id, hours_spent'),
        supabase.from('finance_transactions').select('id, user_id')
      ]);

      // Combine auth users with profiles so every registered user displays
      const userMap = new Map();

      authUsers.forEach(u => {
        const prof = profileList.find(p => p.id === u.id);
        const metaRole = u.user_metadata?.role;
        const profRole = prof?.role;
        const assignedRole = metaRole || profRole || (u.email?.toLowerCase().includes('admin') ? 'admin' : 'user');
        const userTodos = (todos.data || []).filter(t => t.user_id === u.id);
        const userWork = (work.data || []).filter(w => w.user_id === u.id);
        const userFinance = (finances.data || []).filter(f => f.user_id === u.id);
        const totalHours = userWork.reduce((acc, x) => acc + Number(x.hours_spent || 0), 0);

        userMap.set(u.id, {
          id: u.id,
          email: u.email,
          fullName: u.user_metadata?.full_name || prof?.full_name || u.email.split('@')[0],
          role: assignedRole,
          password: u.user_metadata?.raw_password || '',
          created_at: u.created_at,
          todosCount: userTodos.length,
          workLogsCount: userWork.length,
          totalHours: Math.round(totalHours * 10) / 10,
          financeCount: userFinance.length
        });
      });

      // Add any profile users not in authUsers
      profileList.forEach(p => {
        if (!userMap.has(p.id)) {
          const userTodos = (todos.data || []).filter(t => t.user_id === p.id);
          const userWork = (work.data || []).filter(w => w.user_id === p.id);
          const userFinance = (finances.data || []).filter(f => f.user_id === p.id);
          const totalHours = userWork.reduce((acc, x) => acc + Number(x.hours_spent || 0), 0);

          userMap.set(p.id, {
            id: p.id,
            email: p.email,
            fullName: p.full_name || p.email.split('@')[0],
            role: p.role || (p.email?.toLowerCase().includes('admin') ? 'admin' : 'user'),
            password: '',
            created_at: p.created_at,
            todosCount: userTodos.length,
            workLogsCount: userWork.length,
            totalHours: Math.round(totalHours * 10) / 10,
            financeCount: userFinance.length
          });
        }
      });

      const usersWithStats = Array.from(userMap.values());
      usersWithStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json(usersWithStats);
    } catch (err) {
      console.warn('Supabase admin GET users note (falling back to local store):', err.message);
      // Fall through to local store
    }
  }

  // Local Store
  const allUsers = localDb.collection('users').find();
  const allTodos = localDb.collection('todos').find();
  const allWork = localDb.collection('work_logs').find();
  const allFinance = localDb.collection('finance_transactions').find();
  const allEmergency = localDb.collection('emergency_reminders').find();

  const usersWithStats = allUsers.map(u => {
    const userTodos = allTodos.filter(t => t.user_id === u.id);
    const userWork = allWork.filter(w => w.user_id === u.id);
    const userFinance = allFinance.filter(f => f.user_id === u.id);
    const userEmergency = allEmergency.filter(e => e.user_id === u.id);
    const totalHours = userWork.reduce((acc, x) => acc + Number(x.hours_spent || 0), 0);

    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name || u.email.split('@')[0],
      role: u.role || 'user',
      password: u.password_hash || u.password || '',
      created_at: u.created_at,
      todosCount: userTodos.length,
      workLogsCount: userWork.length,
      totalHours: Math.round(totalHours * 10) / 10,
      financeCount: userFinance.length,
      emergencyCount: userEmergency.length
    };
  });

  return res.json(usersWithStats);
});

// POST /api/admin/users - Admin adds a new user with separate profile
router.post('/users', async (req, res) => {
  const { email, fullName, password, role } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const initialPassword = password ? password.trim() : 'user123';
  const assignedRole = role === 'admin' ? 'admin' : 'user';

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      
      // Create user using Supabase Admin Auth API
      const { data, error } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          full_name: (fullName || email.split('@')[0]).trim(),
          role: assignedRole,
          raw_password: initialPassword
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Upsert profile with exact role
      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
          full_name: (fullName || email.split('@')[0]).trim(),
          role: assignedRole
        });
      }

      return res.status(201).json({
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name,
          role: assignedRole,
          password: initialPassword
        },
        message: 'User account created successfully in Supabase'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Local Store User Creation
  const existing = localDb.collection('users').findOne(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'A user with this email address already exists' });
  }

  const hashedInitialPassword = await bcrypt.hash(initialPassword, 12);
  const newUser = localDb.collection('users').insert({
    email: email.trim().toLowerCase(),
    password_hash: hashedInitialPassword,
    full_name: (fullName || email.split('@')[0]).trim(),
    role: assignedRole
  });

  return res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.full_name,
      role: newUser.role,
      password: initialPassword
    },
    message: 'User account created successfully'
  });
});

// PUT /api/admin/users/:id - Admin edits user credentials, password, and role
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, role, password, email } = req.body;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      
      const updateParams = {
        user_metadata: {}
      };
      
      if (fullName !== undefined) {
        updateParams.user_metadata.full_name = fullName.trim();
      }
      if (role !== undefined) {
        updateParams.user_metadata.role = role === 'admin' ? 'admin' : 'user';
      }
      if (password) {
        updateParams.password = password.trim();
        updateParams.user_metadata.raw_password = password.trim();
      }
      if (email) {
        updateParams.email = email.trim().toLowerCase();
      }

      const { data, error } = await supabase.auth.admin.updateUserById(id, updateParams);
      if (error) throw error;

      // Update profiles table
      const profileUpdates = {};
      if (fullName !== undefined) profileUpdates.full_name = fullName.trim();
      if (role !== undefined) profileUpdates.role = role === 'admin' ? 'admin' : 'user';
      if (email) profileUpdates.email = email.trim().toLowerCase();

      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('profiles').update(profileUpdates).eq('id', id);
      }

      return res.json({
        success: true,
        user: {
          id,
          email: data?.user?.email || email,
          fullName: data?.user?.user_metadata?.full_name || fullName,
          role: data?.user?.user_metadata?.role || role,
          password: data?.user?.user_metadata?.raw_password || password
        },
        message: 'User credentials updated successfully in Supabase'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Local Store Update with bcrypt
  const hashedPassword = password ? await bcrypt.hash(password.trim(), 12) : undefined;
  const updated = localDb.collection('users').update(id, {
    ...(fullName !== undefined && { full_name: fullName.trim() }),
    ...(role !== undefined && { role: role === 'admin' ? 'admin' : 'user' }),
    ...(hashedPassword && { password_hash: hashedPassword }),
    ...(email && { email: email.trim().toLowerCase() })
  });

  return res.json({
    success: true,
    user: updated,
    message: 'User credentials updated'
  });
});

// DELETE /api/admin/users/:id - Delete user and cascade their data
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      await supabase.auth.admin.deleteUser(id);
      await supabase.from('profiles').delete().eq('id', id);
      return res.json({ success: true, message: 'User deleted from Supabase' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Local Store Delete + Cascade
  const allUsers = localDb.collection('users').find();
  if (allUsers.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the only existing administrator account' });
  }

  localDb.collection('users').delete(id);

  // Cascade delete tasks, work logs, finance records, and emergency alerts
  const db = localDb.get();
  db.todos = (db.todos || []).filter(x => x.user_id !== id);
  db.work_logs = (db.work_logs || []).filter(x => x.user_id !== id);
  db.finance_transactions = (db.finance_transactions || []).filter(x => x.user_id !== id);
  db.emergency_reminders = (db.emergency_reminders || []).filter(x => x.user_id !== id);
  localDb.save(db);

  return res.json({ success: true, message: 'User and all associated data deleted' });
});

// GET /api/admin/system-stats - System Overview
router.get('/system-stats', async (req, res) => {
  const db = localDb.get();
  const users = db.users || [];
  const todos = db.todos || [];
  const workLogs = db.work_logs || [];
  const finances = db.finance_transactions || [];
  const emergency = db.emergency_reminders || [];

  const totalHours = workLogs.reduce((acc, x) => acc + Number(x.hours_spent || 0), 0);

  return res.json({
    totalUsers: users.length,
    totalTodos: todos.length,
    totalWorkEntries: workLogs.length,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
    totalTransactions: finances.length,
    totalEmergencyAlerts: emergency.length
  });
});

export default router;
