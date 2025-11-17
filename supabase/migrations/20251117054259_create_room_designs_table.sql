/*
  # Create room_designs table for storing generated interior designs

  1. New Tables
    - `room_designs`
      - `id` (uuid, primary key) - Unique identifier for each design
      - `session_id` (text) - Session identifier to group designs by user
      - `original_image_url` (text) - URL/path to the original uploaded room image
      - `generated_image_data` (text) - Base64 encoded generated room design image
      - `design_metadata` (jsonb) - Stores design parameters (design_type, room_type, style, colors, etc.)
      - `description` (text) - AI-generated description of the design
      - `created_at` (timestamptz) - Timestamp of when design was created

  2. Security
    - Enable RLS on `room_designs` table
    - Add policy for anyone to insert designs (no auth required for testing)
    - Add policy for anyone to read designs by session_id
*/

CREATE TABLE IF NOT EXISTS room_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  original_image_url text,
  generated_image_data text NOT NULL,
  design_metadata jsonb DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert room designs"
  ON room_designs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read room designs"
  ON room_designs
  FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_room_designs_session_id ON room_designs(session_id);
CREATE INDEX IF NOT EXISTS idx_room_designs_created_at ON room_designs(created_at DESC);