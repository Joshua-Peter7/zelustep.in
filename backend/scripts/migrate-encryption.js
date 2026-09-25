import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { encryptField } from '../utils/crypto.js';
import { getSupabase, isSupabaseConnected } from '../config/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local_db.json');
const BACKUP_PATH = path.resolve(__dirname, `../data/local_db_backup_${Date.now()}.json`);

console.log('🔒 Running one-time AES-256-GCM field encryption migration...');

// 1. Back up local database
if (fs.existsSync(LOCAL_DB_PATH)) {
  fs.copyFileSync(LOCAL_DB_PATH, BACKUP_PATH);
  console.log(`📦 Backup created successfully at: ${BACKUP_PATH}`);
}

// 2. Encrypt localDb records
if (fs.existsSync(LOCAL_DB_PATH)) {
  const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
  const db = JSON.parse(content);

  let localFinanceEncrypted = 0;
  let localEmergencyEncrypted = 0;

  (db.finance_transactions || []).forEach(tx => {
    if (tx.description && !isAlreadyEncrypted(tx.description)) {
      tx.description = encryptField(tx.description);
      localFinanceEncrypted++;
    }
  });

  (db.emergency_reminders || []).forEach(rem => {
    if (rem.details && !isAlreadyEncrypted(rem.details)) {
      rem.details = encryptField(rem.details);
      localEmergencyEncrypted++;
    }
  });

  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`✅ Local storage migration:`);
  console.log(`   - Encrypted ${localFinanceEncrypted} finance descriptions`);
  console.log(`   - Encrypted ${localEmergencyEncrypted} emergency details`);
}

// 3. Encrypt Supabase records if connected
if (isSupabaseConnected()) {
  console.log('\n☁️  Checking Supabase database tables...');
  const supabase = getSupabase();

  try {
    const { data: financeRows, error: fErr } = await supabase.from('finance_transactions').select('id, description');
    if (!fErr && financeRows) {
      let sbFinanceCount = 0;
      for (const row of financeRows) {
        if (row.description && !isAlreadyEncrypted(row.description)) {
          const encrypted = encryptField(row.description);
          await supabase.from('finance_transactions').update({ description: encrypted }).eq('id', row.id);
          sbFinanceCount++;
        }
      }
      console.log(`   - Supabase: Encrypted ${sbFinanceCount} finance transactions`);
    }

    const { data: emergencyRows, error: eErr } = await supabase.from('emergency_reminders').select('id, details');
    if (!eErr && emergencyRows) {
      let sbEmergencyCount = 0;
      for (const row of emergencyRows) {
        if (row.details && !isAlreadyEncrypted(row.details)) {
          const encrypted = encryptField(row.details);
          await supabase.from('emergency_reminders').update({ details: encrypted }).eq('id', row.id);
          sbEmergencyCount++;
        }
      }
      console.log(`   - Supabase: Encrypted ${sbEmergencyCount} emergency reminders`);
    }
  } catch (err) {
    console.warn('⚠️ Note during Supabase table migration:', err.message);
  }
}

function isAlreadyEncrypted(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

console.log('\n====================================================');
console.log('✅ AES-256-GCM encryption migration completed.');
console.log('====================================================\n');
