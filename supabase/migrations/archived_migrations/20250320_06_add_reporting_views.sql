/*
  # Add Sample Notifications Data

  1. Changes
    - Add sample notifications for testing and demonstration
    - Cover all notification types
    - Include realistic amounts and descriptions
*/

-- Insert sample notifications
INSERT INTO notifications (
  type,
  claim_id,
  title,
  description,
  amount,
  action_url,
  user_id,
  created_at,
  is_read
)
SELECT
  type,
  claim_id,
  title,
  description,
  amount,
  action_url,
  user_id,
  created_at,
  is_read
FROM (
  VALUES
    (
      'initial_proposal'::notification_type,
      '316514501',
      'Initial Settlement Proposal',
      'Provider ABC has proposed a settlement amount of $1,000.',
      1000.00,
      '/claims/detail/316514501',
      (SELECT id FROM auth.users WHERE email = 'test@healthcare.com'),
      NOW() - INTERVAL '1 day',
      false
    ),
    (
      'counter_proposal'::notification_type,
      '316514502',
      'Counter Proposal Submitted',
      'You have submitted a counter proposal of $800.',
      800.00,
      '/claims/detail/316514502',
      (SELECT id FROM auth.users WHERE email = 'test@healthcare.com'),
      NOW() - INTERVAL '3 days',
      false
    ),
    (
      'lawyer_intervention'::notification_type,
      '316514503',
      'Lawyer Intervention Required',
      'A lawyer has been assigned to mediate the settlement.',
      NULL,
      '/claims/detail/316514503',
      (SELECT id FROM auth.users WHERE email = 'test@healthcare.com'),
      NOW() - INTERVAL '5 days',
      false
    ),
    (
      'settlement_reached'::notification_type,
      '316514504',
      'Settlement Agreement Reached',
      'An agreement has been reached to settle the amount at $950.',
      950.00,
      '/claims/detail/316514504',
      (SELECT id FROM auth.users WHERE email = 'test@healthcare.com'),
      NOW() - INTERVAL '7 days',
      true
    ),
    (
      'payment_received'::notification_type,
      '316514505',
      'Payment Received',
      'Payment of $1,200 has been processed and received.',
      1200.00,
      '/claims/detail/316514505',
      (SELECT id FROM auth.users WHERE email = 'test@healthcare.com'),
      NOW() - INTERVAL '10 days',
      true
    )
) AS v(type, claim_id, title, description, amount, action_url, user_id, created_at, is_read)
WHERE NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE claim_id = v.claim_id AND type = v.type
);