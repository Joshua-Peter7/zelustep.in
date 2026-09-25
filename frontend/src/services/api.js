const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5200/api';

function getAuthHeaders() {
  const userJson = localStorage.getItem('zelustep_user') || localStorage.getItem('omni_user');
  let userId = 'usr_guest';
  let userEmail = 'user@example.com';
  let userRole = 'user';
  let token = null;

  if (userJson) {
    try {
      const parsed = JSON.parse(userJson);
      userId = parsed.id || userId;
      userEmail = parsed.email || userEmail;
      userRole = parsed.role || userRole;
      token = parsed.token;
    } catch (e) {
      // ignore
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'x-user-email': userEmail,
    'x-user-role': userRole
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  return data;
}

export const api = {
  // Auth
  auth: {
    login: (email, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
    register: (email, password, fullName) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName })
    })
  },

  // Daily To-Do
  todos: {
    getAll: () => request('/todos'),
    create: (todo) => request('/todos', {
      method: 'POST',
      body: JSON.stringify(todo)
    }),
    update: (id, updates) => request(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
    delete: (id) => request(`/todos/${id}`, {
      method: 'DELETE'
    }),
    testEmail: (id) => request(`/todos/${id}/test-email`, {
      method: 'POST'
    })
  },

  // Daily Work Tracker
  workLogs: {
    getByDate: (date) => request(`/work-logs?date=${date}`),
    getCalendarOverview: (month) => request(`/work-logs/calendar-dates?month=${month}`),
    getRange: (start, end) => request(`/work-logs/range?start=${start}&end=${end}`),
    create: (log) => request('/work-logs', {
      method: 'POST',
      body: JSON.stringify(log)
    }),
    update: (id, updates) => request(`/work-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
    delete: (id) => request(`/work-logs/${id}`, {
      method: 'DELETE'
    })
  },

  // Emergency Reminders
  emergency: {
    getAll: () => request('/emergency-reminders'),
    create: (reminder) => request('/emergency-reminders', {
      method: 'POST',
      body: JSON.stringify(reminder)
    }),
    dismiss: (id) => request(`/emergency-reminders/${id}/dismiss`, {
      method: 'PUT'
    }),
    delete: (id) => request(`/emergency-reminders/${id}`, {
      method: 'DELETE'
    }),
    testEmail: (id) => request(`/emergency-reminders/${id}/test-email`, {
      method: 'POST'
    })
  },

  // Money Dashboard
  finance: {
    getSummary: (year, month) => request(`/finance/summary?year=${year}&month=${month}`),
    getTransactions: (year, month, type) => {
      let url = `/finance/transactions?year=${year || new Date().getFullYear()}`;
      if (month && month !== 'null' && month !== 'all') {
        url += `&month=${month}`;
      }
      if (type && type !== 'all') {
        url += `&type=${type}`;
      }
      return request(url);
    },
    createTransaction: (tx) => request('/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(tx)
    }),
    deleteTransaction: (id) => request(`/finance/transactions/${id}`, {
      method: 'DELETE'
    })
  },

  // Settings & Status
  settings: {
    getStatus: () => request('/settings/status'),
    updateKeys: (keys) => request('/settings/update-keys', {
      method: 'POST',
      body: JSON.stringify(keys)
    }),
    testEmail: (email) => request('/settings/test-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  },

  // Admin Management
  admin: {
    getUsers: () => request('/admin/users'),
    createUser: (userData) => request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    updateUser: (id, userData) => request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),
    deleteUser: (id) => request(`/admin/users/${id}`, {
      method: 'DELETE'
    }),
    getStats: () => request('/admin/system-stats')
  }
};
