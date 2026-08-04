import { supabase } from './supabaseClient';

// ===== Suppliers =====

export async function fetchSuppliers() {
  const pageSize = 1000;
  let allData = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function addSupplier({ name, phone, notes }) {
  if (!name || !name.trim()) throw new Error('Supplier name is required');
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ name: name.trim(), phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, { name, phone, notes }) {
  if (!name || !name.trim()) throw new Error('Supplier name is required');
  const { data, error } = await supabase
    .from('suppliers')
    .update({ name: name.trim(), phone, notes })
    .eq('id', id)
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
