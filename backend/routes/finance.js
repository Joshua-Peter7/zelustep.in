import express from 'express';
import { getSupabase, isSupabaseConnected, isValidUUID, localDb } from '../config/supabase.js';
import { authenticateUser } from './auth.js';
import { encryptField, decryptField } from '../utils/crypto.js';

const router = express.Router();
router.use(authenticateUser);

// Helper to seamlessly merge Supabase + localDb so transactions never disappear
async function getAllUserTransactions(userId, userEmail, currentYear) {
  let list = [];
  const idMap = new Set();

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('finance_transactions')
        .select('*')
        .eq('user_id', userId);

      if (currentYear) {
        query = query
          .gte('transaction_date', `${currentYear}-01-01`)
          .lte('transaction_date', `${currentYear}-12-31`);
      }
      query = query.order('transaction_date', { ascending: false });

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const item of data) {
          list.push({
            ...item,
            description: decryptField(item.description)
          });
          idMap.add(String(item.id));
        }
      }
    } catch (err) {
      console.warn('Supabase fetch transactions error:', err.message);
    }
  }

  // Always merge localDb transactions (guarantees local transactions are immediately reflected)
  const localItems = localDb.collection('finance_transactions').find(t => {
    const isUser = !userId || userId === 'usr_guest' || userId === 'usr_default' ||
                   t.user_id === userId || 
                   (t.user_email && userEmail && t.user_email.toLowerCase() === userEmail.toLowerCase()) || 
                   !t.user_id;
    if (!isUser) return false;
    if (currentYear) {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(`${currentYear}`);
    }
    return true;
  });

  for (const item of localItems) {
    if (!idMap.has(String(item.id))) {
      list.push({
        ...item,
        description: decryptField(item.description)
      });
      idMap.add(String(item.id));

      // Asynchronously sync to Supabase if connected
      if (isSupabaseConnected() && isValidUUID(userId) && String(item.id).startsWith('rec_')) {
        try {
          const supabase = getSupabase();
          supabase.from('finance_transactions').insert([{
            user_id: userId,
            type: item.type,
            amount: Number(item.amount),
            category: item.category,
            transaction_date: String(item.transaction_date).split('T')[0],
            description: item.description || null,
            payment_method: item.payment_method || 'UPI (GPay, PhonePe)'
          }]).select().single().then(({ data, error }) => {
            if (!error && data?.id) {
              try {
                localDb.collection('finance_transactions').update(item.id, { id: data.id });
              } catch (_) {}
            }
          }).catch(() => {});
        } catch (_) {}
      }
    }
  }

  list.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  return list;
}

// GET /api/finance/summary - Monthly and yearly metrics (Received, Spent, Saved)
router.get('/summary', async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const currentYear = parseInt(req.query.year || new Date().getFullYear());
  const currentMonth = parseInt(req.query.month || (new Date().getMonth() + 1)); // 1-12
  const monthString = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const transactions = await getAllUserTransactions(userId, userEmail, currentYear);

  // 1. MONTHLY CALCULATIONS
  const monthlyTransactions = transactions.filter(t => {
    const dStr = String(t.transaction_date || '').split('T')[0];
    return dStr.startsWith(monthString);
  });
  let monthlyReceived = 0;
  let monthlySpent = 0;
  const monthlyCategoryMap = {};

  monthlyTransactions.forEach(t => {
    const amount = Number(t.amount);
    if (t.type === 'income') {
      monthlyReceived += amount;
    } else if (t.type === 'expense') {
      monthlySpent += amount;
      monthlyCategoryMap[t.category] = (monthlyCategoryMap[t.category] || 0) + amount;
    }
  });

  const monthlySaved = monthlyReceived - monthlySpent;
  const monthlySavingsRate = monthlyReceived > 0 
    ? Math.round((monthlySaved / monthlyReceived) * 100) 
    : 0;

  const categoryBreakdown = Object.entries(monthlyCategoryMap).map(([category, total]) => ({
    category,
    amount: total,
    percentage: monthlySpent > 0 ? Math.round((total / monthlySpent) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  // 2. YEARLY CALCULATIONS
  let yearlyReceived = 0;
  let yearlySpent = 0;
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mStr = `${currentYear}-${String(m).padStart(2, '0')}`;
    const monthItems = transactions.filter(t => {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(mStr);
    });
    const rec = monthItems.filter(t => t.type === 'income').reduce((acc, x) => acc + Number(x.amount), 0);
    const sp = monthItems.filter(t => t.type === 'expense').reduce((acc, x) => acc + Number(x.amount), 0);
    
    yearlyReceived += rec;
    yearlySpent += sp;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      monthNumber: m,
      monthName: monthNames[i],
      received: rec,
      spent: sp,
      saved: rec - sp
    };
  });

  const yearlySaved = yearlyReceived - yearlySpent;
  const yearlySavingsRate = yearlyReceived > 0 
    ? Math.round((yearlySaved / yearlyReceived) * 100) 
    : 0;

  return res.json({
    selectedYear: currentYear,
    selectedMonth: currentMonth,
    monthly: {
      received: monthlyReceived,
      spent: monthlySpent,
      saved: monthlySaved,
      savingsRate: monthlySavingsRate,
      categoryBreakdown,
      transactionsCount: monthlyTransactions.length
    },
    yearly: {
      received: yearlyReceived,
      spent: yearlySpent,
      saved: yearlySaved,
      savingsRate: yearlySavingsRate,
      monthlyTrend
    }
  });
});

// GET /api/finance/transactions - List transactions with filtering
router.get('/transactions', async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const { month, year, type } = req.query;

  let items = await getAllUserTransactions(userId, userEmail, year ? parseInt(year) : null);

  const numYear = year && year !== 'null' && year !== 'undefined' ? parseInt(year) : null;
  const numMonth = month && month !== 'null' && month !== 'undefined' && month !== 'all' ? parseInt(month) : null;

  if (numYear && numMonth) {
    const mStr = `${numYear}-${String(numMonth).padStart(2, '0')}`;
    items = items.filter(t => {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(mStr);
    });
  } else if (numYear) {
    items = items.filter(t => {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(`${numYear}`);
    });
  }

  if (type && type !== 'all') {
    items = items.filter(t => t.type === type);
  }

  return res.json(items);
});

// POST /api/finance/transactions - Record income or expense
router.post('/transactions', async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const { type, amount, category, transaction_date, description, payment_method } = req.body;

  if (!type || !amount || !category || !transaction_date) {
    return res.status(400).json({ error: 'Type, amount, category, and date are required' });
  }

  const dateClean = String(transaction_date).split('T')[0];
  const encryptedDescription = encryptField(description ? description.trim() : null);

  const newTx = {
    user_id: userId,
    user_email: userEmail,
    type,
    amount: Number(amount),
    category,
    transaction_date: dateClean,
    description: encryptedDescription,
    payment_method: payment_method || 'UPI (GPay, PhonePe)'
  };

  // Only pass columns that exist in Supabase schema (no user_email column)
  const supabasePayload = {
    user_id: isValidUUID(userId) ? userId : undefined,
    type,
    amount: Number(amount),
    category,
    transaction_date: dateClean,
    description: encryptedDescription,
    payment_method: payment_method || 'UPI (GPay, PhonePe)'
  };

  let savedTx = null;

  if (isSupabaseConnected() && isValidUUID(userId)) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('finance_transactions')
        .insert([supabasePayload])
        .select()
        .single();

      if (!error && data) {
        savedTx = data;
        // Mirror to local db
        try {
          localDb.collection('finance_transactions').insert({ ...newTx, id: data.id });
        } catch (_) {}
      } else if (error) {
        console.warn('Supabase POST transaction note (falling back to local storage):', error.message);
      }
    } catch (err) {
      console.warn('Supabase POST transaction error:', err.message);
    }
  }

  if (!savedTx) {
    savedTx = localDb.collection('finance_transactions').insert(newTx);
  }

  return res.status(201).json({
    ...savedTx,
    description: decryptField(savedTx.description)
  });
});

// DELETE /api/finance/transactions/:id
router.delete('/transactions/:id', async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConnected() && isValidUUID(id)) {
    try {
      const supabase = getSupabase();
      await supabase.from('finance_transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase DELETE error:', err.message);
    }
  }

  try {
    localDb.collection('finance_transactions').delete(id);
  } catch (_) {}

  return res.json({ success: true, message: 'Transaction deleted' });
});

export default router;
