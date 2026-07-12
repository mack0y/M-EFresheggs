-- ============================================
-- Fix operational_funds balance trigger
-- Adds a running balance column and a BEFORE INSERT
-- trigger to automatically maintain it.
-- ============================================

-- 1. Add a balance column to operational_funds (if not already present)
ALTER TABLE operational_funds
  ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- 2. Drop the old trigger function if it exists (broken variable-scoping version)
DROP TRIGGER IF EXISTS trg_funds_balance ON operational_funds;
DROP FUNCTION IF EXISTS update_funds_balance();

-- 3. Create the corrected trigger function
CREATE OR REPLACE FUNCTION update_funds_balance()
RETURNS TRIGGER AS $$
DECLARE
  last_balance NUMERIC(10, 2);
BEGIN
  -- Get the balance from the most recent entry (by fund_date, then created_at)
  SELECT balance INTO last_balance
  FROM operational_funds
  WHERE (fund_date < NEW.fund_date OR (fund_date = NEW.fund_date AND created_at < NEW.created_at))
  ORDER BY fund_date DESC, created_at DESC
  LIMIT 1;

  -- If no previous row exists, start from 0
  IF last_balance IS NULL THEN
    last_balance := 0;
  END IF;

  -- Calculate new running balance
  NEW.balance := last_balance + NEW.amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger (BEFORE INSERT so we can set NEW.balance)
CREATE TRIGGER trg_funds_balance
  BEFORE INSERT ON operational_funds
  FOR EACH ROW
  EXECUTE FUNCTION update_funds_balance();

-- 5. Backfill existing records with correct running balances
-- Uses a recursive CTE to recompute balances in chronological order
WITH RECURSIVE ordered_funds AS (
  SELECT
    id,
    amount,
    fund_date,
    created_at,
    ROW_NUMBER() OVER (ORDER BY fund_date ASC, created_at ASC, id ASC) AS seq
  FROM operational_funds
),
recursive_balance AS (
  -- Base: first entry gets balance = amount
  SELECT
    id,
    amount,
    seq,
    amount::NUMERIC(10,2) AS running_balance
  FROM ordered_funds
  WHERE seq = 1

  UNION ALL

  -- Recursive: each subsequent entry adds its amount
  SELECT
    of2.id,
    of2.amount,
    of2.seq,
    (rb.running_balance + of2.amount::NUMERIC(10,2))::NUMERIC(10,2) AS running_balance
  FROM ordered_funds of2
  JOIN recursive_balance rb ON of2.seq = rb.seq + 1
)
UPDATE operational_funds f
SET balance = rb.running_balance
FROM recursive_balance rb
WHERE f.id = rb.id;
