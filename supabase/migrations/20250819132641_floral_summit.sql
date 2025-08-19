/*
  # Multi-Board System Implementation

  1. New Tables
    - `boards`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, board name)
      - `description` (text, optional description)
      - `is_default` (boolean, marks default board)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `board_data`
      - `board_id` (uuid, foreign key to boards)
      - `data` (jsonb, board state data)
      - `updated_at` (timestamp)
      - `last_write_by` (text, for sync coordination)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own boards
    - Ensure users can only access their own board data

  3. Migration Strategy
    - Migrate existing app_state data to default board
    - Maintain backward compatibility
*/

-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create board_data table
CREATE TABLE IF NOT EXISTS board_data (
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  last_write_by text
);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for boards
CREATE POLICY "Users can view own boards" ON boards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own boards" ON boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boards" ON boards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own boards" ON boards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for board_data
CREATE POLICY "Users can view own board data" ON board_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_data.board_id 
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own board data" ON board_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_data.board_id 
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own board data" ON board_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_data.board_id 
      AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own board data" ON board_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_data.board_id 
      AND boards.user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_boards_updated_at'
  ) THEN
    CREATE TRIGGER update_boards_updated_at
      BEFORE UPDATE ON boards
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_board_data_updated_at'
  ) THEN
    CREATE TRIGGER update_board_data_updated_at
      BEFORE UPDATE ON board_data
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_user_default ON boards(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_board_data_board_id ON board_data(board_id);