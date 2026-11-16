-- Fix: Create merchant entry for user
-- User email: srabonisultana78@gmail.com

-- Step 1: Find user_id
-- Run this first to get the user_id
SELECT id, email FROM auth.users WHERE email = 'srabonisultana78@gmail.com';

-- Step 2: Insert merchant record (replace USER_ID with the id from step 1)
-- After getting user_id, uncomment and run this:
/*
INSERT INTO merchants (user_id, wallet_address, accepted_currencies, fee_percentage, status)
VALUES (
  'YOUR_USER_ID_HERE',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',  -- Default wallet
  ARRAY['USDC', 'EURC'],
  2.5,
  'active'
)
ON CONFLICT (user_id) DO NOTHING;
*/

-- Step 3: Verify
-- SELECT * FROM merchants WHERE user_id = 'YOUR_USER_ID_HERE';
