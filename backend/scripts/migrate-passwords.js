import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local_db.json');

console.log('🔒 Running one-time password security migration...');

if (!fs.existsSync(LOCAL_DB_PATH)) {
  console.log('ℹ️  No local database file found at:', LOCAL_DB_PATH);
  process.exit(0);
}

let db = null;
try {
  const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
  db = JSON.parse(content);
} catch (err) {
  console.error('❌ Failed to read local_db.json:', err.message);
  process.exit(1);
}

const users = db.users || [];
let flaggedCount = 0;
let alreadyHashedCount = 0;

for (const user of users) {
  const hash = user.password_hash || '';
  const isBcrypt = hash.startsWith('$2b$') || hash.startsWith('$2a$');

  if (!isBcrypt) {
    // Flag account for forced password reset — do NOT silently rehash unknown plaintext values
    user.needs_password_reset = true;
    user.password_hash = null; // Clear raw plaintext for security
    user.flagged_at = new Date().toISOString();
    flaggedCount++;
    console.log(`⚠️  User "${user.email}" has unhashed credentials. Flagged for forced password reset.`);
  } else {
    alreadyHashedCount++;
  }
}

fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

console.log(`\n====================================================`);
console.log(`✅ Password migration complete:`);
console.log(`   - Verified bcrypt accounts: ${alreadyHashedCount}`);
console.log(`   - Flagged for forced reset: ${flaggedCount}`);
console.log(`====================================================\n`);
