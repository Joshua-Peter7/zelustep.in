import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getSupabase, isSupabaseConnected, localDb } from '../config/supabase.js';
import { requireAuth, requireRole, authenticateUser } from '../middleware/auth.js';

export { requireAuth, requireRole, authenticateUser };

const router = express.Router();

// Strict IP-based rate limiter for authentication endpoints: max 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Helper to sign unified application JWT
function generateAuthToken(payload) {
  const secret = process.env.JWT_SECRET || 'default_jwt_secret_dev_only';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // 1. Attempt Supabase Auth login if configured
  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'default123',
      });

      if (!error && data?.user) {
        let role = data.user.user_metadata?.role;
        let fullName = data.user.user_metadata?.full_name;

        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', data.user.id)
            .single();
          if (prof?.role) role = prof.role;
          if (prof?.full_name) fullName = prof.full_name;
        } catch (_) {}

        if (!role) {
          role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
        }

        // Mint signed JWT containing userId, email, role, expiresIn: '1h'
        const signedToken = generateAuthToken({
          userId: data.user.id,
          email: data.user.email,
          role
        });

        return res.json({
          user: {
            id: data.user.id,
            email: data.user.email,
            fullName: fullName || email.split('@')[0],
            role
          },
          token: signedToken || data.session?.access_token,
        });
      }
    } catch (err) {
      // Fall through to localDb
    }
  }

  // 2. Local Store Login with bcrypt comparison
  const existing = localDb.collection('users').findOne(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    // Check if account is flagged for forced reset
    if (existing.needs_password_reset) {
      return res.status(403).json({
        error: 'Password reset required. Your account security must be updated. Please reset your password.',
        needs_password_reset: true
      });
    }

    let isPasswordValid = false;
    if (existing.password_hash) {
      const isBcryptHash = existing.password_hash.startsWith('$2b$') || existing.password_hash.startsWith('$2a$');
      if (isBcryptHash) {
        isPasswordValid = await bcrypt.compare(password, existing.password_hash);
      } else {
        // Plaintext legacy check: if matches, flag for forced reset
        if (existing.password_hash === password) {
          existing.needs_password_reset = true;
          localDb.save(localDb.get());
          return res.status(403).json({
            error: 'Password reset required. Plaintext password detected. Please reset your password.',
            needs_password_reset: true
          });
        }
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Please verify credentials.' });
    }

    const role = existing.role || (existing.email.toLowerCase().includes('admin') ? 'admin' : 'user');

    // Issue signed JWT containing userId, email, role, expiresIn: '1h'
    const token = generateAuthToken({
      userId: existing.id,
      email: existing.email,
      role
    });

    return res.json({
      user: {
        id: existing.id,
        email: existing.email,
        fullName: existing.full_name || email.split('@')[0],
        role
      },
      token
    });
  }

  return res.status(401).json({ 
    error: 'Invalid credentials or account does not exist. Please check your details.' 
  });
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0]
          }
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({
        user: {
          id: data.user?.id,
          email: data.user?.email,
          fullName: fullName || email.split('@')[0]
        },
        message: 'Registration successful'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Dynamic Local Store with bcrypt hash (cost factor 12)
  const existing = localDb.collection('users').findOne(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const created = localDb.collection('users').insert({
    email,
    password_hash: hashedPassword,
    full_name: fullName || email.split('@')[0],
    role: email.toLowerCase().includes('admin') ? 'admin' : 'user'
  });

  return res.json({
    user: {
      id: created.id,
      email: created.email,
      fullName: created.full_name
    },
    message: 'Account created successfully'
  });
});

export default router;
