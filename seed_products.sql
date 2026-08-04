-- Seed data: Frozen Goods only
-- Run this in Supabase SQL Editor

INSERT INTO products (name, category, unit, purchase_unit, purchase_qty_per_unit, cost, price, quantity_on_hand) VALUES
  ('Chicken Nugget (500g)', 'Frozen', 'pack', 'box', 12, 180.00, 250.00, 48),
  ('Chicken Nugget (1kg)', 'Frozen', 'pack', 'box', 6, 320.00, 450.00, 24),
  ('Chicken Breast Fillet (500g)', 'Frozen', 'pack', 'box', 10, 200.00, 280.00, 36),
  ('Chicken Thigh (500g)', 'Frozen', 'pack', 'box', 10, 160.00, 230.00, 40),
  ('Chicken Wings (500g)', 'Frozen', 'pack', 'box', 10, 150.00, 220.00, 30),
  ('Pork Giniling (500g)', 'Frozen', 'pack', 'box', 12, 130.00, 190.00, 36),
  ('Pork Chop (500g)', 'Frozen', 'pack', 'box', 10, 170.00, 240.00, 20),
  ('Pork Belly (500g)', 'Frozen', 'pack', 'box', 10, 210.00, 290.00, 18),
  ('Fish Fillet (500g)', 'Frozen', 'pack', 'box', 12, 140.00, 200.00, 30),
  ('Bangus (500g)', 'Frozen', 'pack', 'box', 12, 120.00, 175.00, 24),
  ('Squid Rings (250g)', 'Frozen', 'pack', 'box', 12, 110.00, 160.00, 36),
  ('Shrimp (250g)', 'Frozen', 'pack', 'box', 12, 160.00, 230.00, 24),
  ('Lumpia Wrapper (500g)', 'Frozen', 'pack', 'box', 20, 45.00, 70.00, 60),
  ('French Fries (1kg)', 'Frozen', 'pack', 'box', 12, 100.00, 150.00, 48),
  ('Hash Brown (450g)', 'Frozen', 'pack', 'box', 12, 85.00, 125.00, 36),
  ('Hotdog (500g)', 'Frozen', 'pack', 'box', 12, 90.00, 130.00, 42),
  ('Longganisa (500g)', 'Frozen', 'pack', 'box', 12, 95.00, 140.00, 30),
  ('Tocino (500g)', 'Frozen', 'pack', 'box', 12, 100.00, 150.00, 24),
  ('Embutido (500g)', 'Frozen', 'pack', 'box', 12, 110.00, 160.00, 18),
  ('Ice Cream (1L)', 'Frozen', 'tub', 'case', 6, 120.00, 185.00, 24);
