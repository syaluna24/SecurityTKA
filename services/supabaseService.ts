
import { createClient } from '@supabase/supabase-js';

// Catatan: Variabel lingkungan ini harus dikonfigurasi di dashboard Supabase Anda
// Untuk keperluan demo ini, kita menggunakan nilai placeholder yang harus diganti
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper untuk fetch data awal
export const fetchInitialData = async (table: string) => {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
  return data;
};

// Helper untuk realtime subscription
export const subscribeTable = (table: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe();
};
