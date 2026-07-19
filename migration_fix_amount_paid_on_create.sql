-- ============================================
-- Migration: Fix amount_paid for existing deliveries
-- Run this in your Supabase SQL Editor
-- ============================================
-- This backfills deliveries that were recorded with payment_status='paid'
-- but had amount_paid=0 because the recordDeliveryBatch/recordDelivery
-- functions didn't set amount_paid at creation time.
-- ============================================

-- Set amount_paid = total_cost for all deliveries with status 'paid'
-- that currently have amount_paid = 0 or NULL
UPDATE deliveries 
SET amount_paid = total_cost 
WHERE payment_status = 'paid' 
  AND (amount_paid IS NULL OR amount_paid = 0);

-- Also fix product_deliveries with the same issue
UPDATE product_deliveries 
SET amount_paid = total_cost 
WHERE payment_status = 'paid' 
  AND (amount_paid IS NULL OR amount_paid = 0);
