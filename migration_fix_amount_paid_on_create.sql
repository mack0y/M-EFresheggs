-- ============================================
-- Migration: Fix amount_paid for existing deliveries
-- Run this in your Supabase SQL Editor
-- ============================================
-- This backfills deliveries that were recorded with payment_status='paid'
-- but had either amount_paid=0 (because recordDeliveryBatch/recordDelivery
-- didn't set it at creation) or wrong amount_paid (from old delta-based 
-- distribution bug that set batch total to each item).
-- ============================================

-- Fix ALL 'paid' items: set amount_paid = item's own total_cost
-- This fixes both:
--   1. Items with amount_paid = 0 (created as 'paid' from form)
--   2. Items with amount_paid = batch_total instead of individual cost (old distribution bug)
UPDATE deliveries 
SET amount_paid = total_cost 
WHERE payment_status = 'paid';

-- Also fix product_deliveries with the same issue
UPDATE product_deliveries 
SET amount_paid = total_cost 
WHERE payment_status = 'paid';
