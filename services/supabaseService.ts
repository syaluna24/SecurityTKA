
import { createClient } from '@supabase/supabase-js';

// Mengambil variabel yang sudah didefinisikan di vite.config.ts
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Inisialisasi client dengan fallback ke URL placeholder jika env tidak ada
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseKey || 'placeholder-key'
);

export const fetchInitialData = async (table: string) => {
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    console.warn(`Supabase credentials missing for ${table}. Using local/mock data.`);
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(`Supabase connection error for ${table}.`);
    return [];
  }
};

export const subscribeTable = (table: string, callback: (payload: any) => void) => {
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return { unsubscribe: () => {} };
  }
  
  try {
    const channel = supabase
      .channel(`${table}_realtime_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
      .subscribe();
      
    return channel;
  } catch (e) {
    console.error(`Subscription error for ${table}:`, e);
    return { unsubscribe: () => {} };
  }
};
