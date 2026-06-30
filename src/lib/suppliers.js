import { supabase } from './supabaseClient';

// ===== Suppliers =====

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addSupplier({ name, phone, notes }) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name, phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSupplier(id) {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
