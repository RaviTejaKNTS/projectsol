-- Migration: Add current_board_id to user_settings table
-- This allows users to remember their last selected board across devices and sessions

-- Add the current_board_id column to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS current_board_id UUID REFERENCES boards(id) ON DELETE SET NULL;

-- Add an index for better performance when querying by current_board_id
CREATE INDEX IF NOT EXISTS idx_user_settings_current_board_id 
ON user_settings(current_board_id);

-- Add a comment to document the purpose of this field
COMMENT ON COLUMN user_settings.current_board_id IS 'The ID of the board the user was last viewing. Used to restore user context on login/reload.';
