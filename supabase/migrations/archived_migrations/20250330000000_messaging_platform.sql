-- Migration: Messaging Platform
-- Description: Creates tables and policies for the HIPAA-compliant messaging system
-- Date: 2025-03-30

-- Message threads table
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  claim_id TEXT REFERENCES healthcare_claims(claim_id), 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status_code TEXT NOT NULL DEFAULT 'ACTIVE',
  status_desc TEXT NOT NULL DEFAULT 'Active',
  thread_type_code TEXT NOT NULL DEFAULT 'GEN',
  thread_type_desc TEXT NOT NULL DEFAULT 'General',
  priority_code TEXT DEFAULT 'NORM',
  priority_desc TEXT DEFAULT 'Normal'
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  encrypted_content TEXT, -- Encrypted client-side
  content_iv TEXT, -- Initialization vector for decryption
  metadata JSONB DEFAULT '{}', -- Non-PHI metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_type_code TEXT DEFAULT 'TEXT',
  message_type_desc TEXT DEFAULT 'Text Message',
  parent_message_id UUID REFERENCES messages(id) -- For threaded replies
);

-- Message attachments table
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  encrypted_key TEXT, -- Encrypted file key
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_hash TEXT -- For integrity verification
);

-- Thread participants table
CREATE TABLE thread_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role_code TEXT NOT NULL DEFAULT 'PART',
  role_desc TEXT NOT NULL DEFAULT 'Participant',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  permissions JSONB DEFAULT '{"can_read": true, "can_write": true}'
);

-- Settlement proposals table
CREATE TABLE settlement_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id),
  claim_id TEXT REFERENCES healthcare_claims(claim_id),
  proposed_amount NUMERIC NOT NULL,
  status_code TEXT NOT NULL DEFAULT 'PEND',
  status_desc TEXT NOT NULL DEFAULT 'Pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiration_date TIMESTAMP WITH TIME ZONE
);

-- Basic read receipts table
CREATE TABLE message_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- Thread access policies
CREATE POLICY "Users can view threads they participate in"
  ON message_threads FOR SELECT
  USING (id IN (
    SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
  ));

-- Message access policies
CREATE POLICY "Users can view messages in their threads"
  ON messages FOR SELECT
  USING (thread_id IN (
    SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages to their threads"
  ON messages FOR INSERT
  WITH CHECK (thread_id IN (
    SELECT thread_id FROM thread_participants 
    WHERE user_id = auth.uid() 
    AND permissions->>'can_write' = 'true'
  ));

CREATE POLICY "Users can view attachments for their messages"
  ON message_attachments FOR SELECT
  USING (message_id IN (
    SELECT id FROM messages WHERE thread_id IN (
      SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert attachments"
  ON message_attachments FOR INSERT
  WITH CHECK (message_id IN (
    SELECT id FROM messages WHERE sender_id = auth.uid()
  ));

CREATE POLICY "Users can manage thread participants"
  ON thread_participants FOR ALL
  USING (thread_id IN (
    SELECT thread_id FROM thread_participants 
    WHERE user_id = auth.uid() 
    AND permissions->>'can_write' = 'true'
  ));

CREATE POLICY "Users can see settlement proposals in their threads"
  ON settlement_proposals FOR SELECT
  USING (thread_id IN (
    SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create settlement proposals"
  ON settlement_proposals FOR INSERT
  WITH CHECK (thread_id IN (
    SELECT thread_id FROM thread_participants 
    WHERE user_id = auth.uid() 
    AND permissions->>'can_write' = 'true'
  ));

CREATE POLICY "Users can update message read status"
  ON message_read_status FOR ALL
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_thread_participants_thread_id ON thread_participants(thread_id);
CREATE INDEX idx_thread_participants_user_id ON thread_participants(user_id);
CREATE INDEX idx_settlement_proposals_thread_id ON settlement_proposals(thread_id);
CREATE INDEX idx_settlement_proposals_claim_id ON settlement_proposals(claim_id);
CREATE INDEX idx_message_thread_claim_id ON message_threads(claim_id);
