/*
  # Add Notifications System

  1. New Tables
    - notifications
      - id (uuid, primary key)
      - type (enum for notification types)
      - claim_id (varchar, references healthcare_claims)
      - title (text)
      - description (text)
      - amount (numeric, optional)
      - created_at (timestamptz)
      - is_read (boolean)
      - action_url (text)
      - user_id (uuid, references auth.users)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'initial_proposal',
  'counter_proposal',
  'lawyer_intervention',
  'settlement_reached',
  'payment_received'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  claim_id varchar NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  amount numeric(10,2),
  created_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  action_url text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_type notification_type,
  p_claim_id varchar,
  p_title text,
  p_description text,
  p_amount numeric,
  p_action_url text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    type,
    claim_id,
    title,
    description,
    amount,
    action_url,
    user_id
  ) VALUES (
    p_type,
    p_claim_id,
    p_title,
    p_description,
    p_amount,
    p_action_url,
    p_user_id
  ) RETURNING id INTO new_notification_id;

  RETURN new_notification_id;
END;
$$;

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Add trigger function to create notifications on negotiation events
CREATE OR REPLACE FUNCTION handle_negotiation_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get the claim owner's user_id
  DECLARE
    claim_owner_id uuid;
    notification_type notification_type;
    notification_title text;
    notification_desc text;
  BEGIN
    -- Determine notification type and content based on negotiation status
    CASE NEW.status
      WHEN 'pending' THEN
        notification_type := 'initial_proposal';
        notification_title := 'New Settlement Proposal';
        notification_desc := 'A new settlement proposal has been submitted for review.';
      WHEN 'counter' THEN
        notification_type := 'counter_proposal';
        notification_title := 'Counter Proposal Received';
        notification_desc := 'A counter proposal has been submitted for your review.';
      WHEN 'lawyer_required' THEN
        notification_type := 'lawyer_intervention';
        notification_title := 'Lawyer Intervention Required';
        notification_desc := 'Legal review is required for this negotiation.';
      WHEN 'accepted' THEN
        notification_type := 'settlement_reached';
        notification_title := 'Settlement Agreement Reached';
        notification_desc := 'A settlement agreement has been reached.';
      ELSE
        RETURN NEW;
    END CASE;

    -- Create notification
    PERFORM create_notification(
      notification_type,
      NEW.claim_id,
      notification_title,
      notification_desc,
      NEW.proposed_amount,
      '/claims/detail/' || NEW.claim_id,
      NEW.created_by
    );
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger for negotiations
CREATE TRIGGER negotiation_notification_trigger
  AFTER INSERT OR UPDATE
  ON negotiations
  FOR EACH ROW
  EXECUTE FUNCTION handle_negotiation_notification();

-- Add comment
COMMENT ON TABLE notifications IS 'Stores user notifications for claim settlement events';