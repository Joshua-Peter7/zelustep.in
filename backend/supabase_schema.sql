-- ==============================================================================
-- OMNITRACK PRO - SUPABASE DATABASE SCHEMA
-- Multi-user Personal Productivity Suite
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USER PROFILES TABLE (Mirrors Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  custom_resend_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TO-DO LIST WITH DEADLINE REMINDERS
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_time TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  email_sent BOOLEAN DEFAULT FALSE,
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DAILY WORK PROGRESS TRACKER (CALENDAR LOGS)
CREATE TABLE IF NOT EXISTS public.work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  title TEXT NOT NULL,
  work_done TEXT NOT NULL,
  hours_spent NUMERIC(5,2) DEFAULT 1.0,
  category TEXT DEFAULT 'Development',
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EMERGENCY REMINDERS (1-HOUR ADVANCE ALERT)
CREATE TABLE IF NOT EXISTS public.emergency_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  target_time TIMESTAMPTZ NOT NULL,
  trigger_time TIMESTAMPTZ NOT NULL, -- Target time minus 1 hour
  email_sent BOOLEAN DEFAULT FALSE,
  user_email TEXT NOT NULL,
  priority TEXT DEFAULT 'emergency' CHECK (priority IN ('urgent', 'emergency', 'critical')),
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MONEY SPEND DASHBOARD (INCOME & EXPENSES)
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  payment_method TEXT DEFAULT 'Bank / Card',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_todos_user_due ON public.todos(user_id, due_time);
CREATE INDEX IF NOT EXISTS idx_todos_email_pending ON public.todos(email_sent, due_time) WHERE email_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON public.work_logs(user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_emergency_user_target ON public.emergency_reminders(user_id, target_time);
CREATE INDEX IF NOT EXISTS idx_emergency_email_pending ON public.emergency_reminders(email_sent, trigger_time) WHERE email_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_finance_user_date ON public.finance_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_user_type ON public.finance_transactions(user_id, type);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures data privacy across all users in multi-user product deployment
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: User can read and update own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Todos
CREATE POLICY "Users can manage own todos" ON public.todos
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Work Logs
CREATE POLICY "Users can manage own work logs" ON public.work_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Emergency Reminders
CREATE POLICY "Users can manage own emergency reminders" ON public.emergency_reminders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Finance
CREATE POLICY "Users can manage own finance transactions" ON public.finance_transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile trigger on auth.users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
