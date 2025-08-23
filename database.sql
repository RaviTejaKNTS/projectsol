-- =====================================================
-- Project Sol - Complete Database Schema
-- =====================================================
-- This file contains everything needed to set up the database
-- Run this in your Supabase SQL editor to get started

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
-- Stores user profile information (display name, avatar)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. APP_STATE TABLE  
-- =====================================================
-- Stores the complete application state for each user
-- This includes columns, tasks, labels, settings, etc.
CREATE TABLE IF NOT EXISTS app_state (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  state JSONB NOT NULL,
  last_write_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
-- This ensures users can only access their own data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES FOR PROFILES TABLE
-- =====================================================
-- Users can only view, update, and insert their own profile

-- View own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Update own profile  
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Insert own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- 5. RLS POLICIES FOR APP_STATE TABLE
-- =====================================================
-- Users can only access their own application state

-- View own app state
CREATE POLICY "Users can view own app state" ON app_state
  FOR SELECT USING (auth.uid() = user_id);

-- Update own app state
CREATE POLICY "Users can update own app state" ON app_state
  FOR UPDATE USING (auth.uid() = user_id);

-- Insert own app state
CREATE POLICY "Users can insert own app state" ON app_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================
-- These indexes will make queries faster

-- Index on app_state for faster user lookups
CREATE INDEX IF NOT EXISTS idx_app_state_user_id ON app_state(user_id);

-- Index on profiles for faster user lookups  
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- =====================================================
-- 7. TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================
-- Automatically update the updated_at timestamp when records change

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for app_state table  
CREATE TRIGGER update_app_state_updated_at 
  BEFORE UPDATE ON app_state 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================
-- Adding comments to help understand the schema

COMMENT ON TABLE profiles IS 'User profile information including display name and avatar';
COMMENT ON TABLE app_state IS 'Complete application state stored as JSONB for each user';
COMMENT ON COLUMN app_state.state IS 'JSONB containing: columns, tasks, labels, settings, filters, shortcuts, theme, etc.';
COMMENT ON COLUMN app_state.last_write_by IS 'Identifier to prevent echo loops in real-time sync';

-- =====================================================
-- 9. GRANT DATABASE PERMISSIONS (CRITICAL FIX)
-- =====================================================
-- This fixes the "permission denied for schema public" error
-- Users need explicit permission to access the public schema

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- Grant specific permissions on your tables
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON app_state TO authenticated;

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================
-- Run these to verify everything is set up correctly

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check if policies exist
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- =====================================================
-- 11. SAMPLE DATA STRUCTURE (for reference)
-- =====================================================
-- This shows what the app_state.state JSONB field contains:

/*
{
  "name": "TasksMint",
  "theme": "dark",
  "sortMode": "manual",
  "columns": [
    {"id": "backlog", "title": "Backlog", "taskIds": []},
    {"id": "inprogress", "title": "In Progress", "taskIds": []},
    {"id": "review", "title": "Review", "taskIds": []},
    {"id": "done", "title": "Done", "taskIds": []}
  ],
  "tasks": {},
  "labels": ["planning", "dev", "docs", "design", "bug"],
  "filters": {"text": "", "priorities": [], "labels": [], "due": "all"},
  "shortcuts": {
    "newTask": "n",
    "newColumn": "shift+n",
    "search": "/",
    "completeTask": "space"
  },
  "deletedTasksSettings": {"enabled": false, "retentionPeriod": "7days"},
  "deletedTasks": []
}
*/

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your Project Sol database is now ready!
-- 
-- Next steps:
-- 1. Update your .env file with new Supabase credentials
-- 2. Test the app - it should work immediately
-- 3. No code changes needed - the app expects exactly this structure
