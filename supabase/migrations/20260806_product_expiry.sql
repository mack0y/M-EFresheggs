-- Product expiry tracking + product loss logging

-- 1. Track expiry per delivery (NULL = long shelf life / no expiry info)
ALTER TABLE product_deliveries ADD COLUMN expiry_date DATE NULL;

-- 2. Backfill: Fresh Vegetable Lumpia (product_id 306) expires 7 days after delivery
UPDATE product_deliveries
SET expiry_date = delivery_date + INTERVAL '7 days'
WHERE product_id = 306;

-- 3. Product loss log
CREATE TABLE product_losses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL,
  reason text NOT NULL DEFAULT 'expired',
  loss_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
