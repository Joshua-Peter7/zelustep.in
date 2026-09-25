import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local_db.json');

// Ensure local data dir exists for fallback persistence
const dataDir = path.dirname(LOCAL_DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

import WebSocket from 'ws';

let supabaseInstance = null;
let isConfigured = false;

export function initSupabase() {
  let rawUrl = process.env.SUPABASE_URL;
  let url = rawUrl ? rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http') && !url.includes('your-project')) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: WebSocket
        }
      });
      isConfigured = true;
      console.log('✅ Supabase Client initialized successfully with:', url);
    } catch (err) {
      console.error('❌ Supabase initialization error:', err.message);
      isConfigured = false;
    }
  } else {
    console.log('ℹ️  Supabase credentials not yet supplied. Using persistent dynamic local storage (data/local_db.json). Connect your Supabase credentials in Settings or .env to switch seamlessly to cloud DB.');
    isConfigured = false;
  }
  return supabaseInstance;
}

export function getSupabase() {
  if (!supabaseInstance && isConfigured) {
    initSupabase();
  }
  return supabaseInstance;
}

export function isSupabaseConnected() {
  return isConfigured && !!supabaseInstance;
}

export function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// ============================================================================
// DYNAMIC LOCAL STORE (Used when Supabase credentials are yet to be entered)
// Guarantees zero hardcoded data, zero initial crashes, and full CRUD persistence!
// ============================================================================
function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local db:', err.message);
  }
  return {
    todos: [],
    work_logs: [],
    emergency_reminders: [],
    finance_transactions: [],
    users: []
  };
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local db:', err.message);
  }
}

export const localDb = {
  get: readLocalDb,
  save: writeLocalDb,
  collection: (table) => {
    const db = readLocalDb();
    if (!db[table]) {
      db[table] = [];
      writeLocalDb(db);
    }
    return {
      find: (filterFn) => {
        const cur = readLocalDb();
        const list = cur[table] || [];
        return filterFn ? list.filter(filterFn) : list;
      },
      findOne: (filterFn) => {
        const cur = readLocalDb();
        const list = cur[table] || [];
        return list.find(filterFn);
      },
      insert: (item) => {
        const cur = readLocalDb();
        if (!cur[table]) cur[table] = [];
        const newItem = {
          id: item.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        cur[table].push(newItem);
        writeLocalDb(cur);
        return newItem;
      },
      update: (id, updates) => {
        const cur = readLocalDb();
        const list = cur[table] || [];
        const idx = list.findIndex(x => x.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
          cur[table] = list;
          writeLocalDb(cur);
          return list[idx];
        }
        return null;
      },
      delete: (id) => {
        const cur = readLocalDb();
        const list = cur[table] || [];
        const filtered = list.filter(x => x.id !== id);
        cur[table] = filtered;
        writeLocalDb(cur);
        return true;
      }
    };
  }
};

// Initialize on boot
initSupabase();
