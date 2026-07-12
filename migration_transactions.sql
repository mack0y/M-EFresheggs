-- ============================================
-- Transactions Migration
-- Links egg sales + product sales into one transaction
-- Safe to re-run (uses IF NOT EXISTS)
-- ============================================

-- 1. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add transaction_id FK to sales (nullable for backward compat)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL;

-- 3. Add transaction_id FK to product_sales (nullable for backward compat)
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(sale_date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_transaction ON sales(transaction_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_transaction ON product_sales(transaction_id);

-- 5. RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on transactions" ON transactions;
CREATE POLICY "Allow all on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
