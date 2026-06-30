import { supabase } from './supabaseClient';

// ===== Customers =====

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addCustomer({ name, phone, notes }) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
