import jwt from 'jsonwebtoken';
import { getSupabase, isSupabaseConnected } from '../config/supabase.js';

/**
 * Middleware to authenticate requests via cryptographically verified JWT.
 * Verifies Authorization: Bearer <token> against server JWT_SECRET or Supabase Auth.
 * Populates req.user = { id, email, role }.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required. Access denied.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format. Bearer token required.' });
  }

  const jwtSecret = process.env.JWT_SECRET;

  // 1. Verify via server-minted JWT
  if (jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role || (decoded.email?.toLowerCase().includes('admin') ? 'admin' : 'user')
      };
      return next();
    } catch (err) {
      // Token might be a direct Supabase Auth token, try Supabase verification below
    }
  }

  // 2. Verify via Supabase Auth if connected
  if (isSupabaseConnected()) {
    try {
      const supabase = getSupabase();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        let role = user.user_metadata?.role;
        if (!role) {
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single();
            if (prof?.role) role = prof.role;
          } catch (_) {}
        }
        role = role || (user.email?.toLowerCase().includes('admin') ? 'admin' : 'user');

        req.user = {
          id: user.id,
          email: user.email,
          role
        };
        return next();
      }
    } catch (supabaseErr) {
      // Supabase verification failed
    }
  }

  return res.status(401).json({ error: 'Session expired or token invalid. Please log in again.' });
}

/**
 * Middleware to require a specific role (e.g. 'admin') after requireAuth.
 */
export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== requiredRole && !req.user.email?.toLowerCase().includes('admin')) {
      return res.status(403).json({ error: `Access denied: Requires ${requiredRole} privileges.` });
    }
    next();
  };
}

// Backwards-compatible export for existing route imports
export const authenticateUser = requireAuth;
export default requireAuth;
