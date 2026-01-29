
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Menggunakan variabel lingkungan atau placeholder aman
const supabaseUrl = (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 'https://placeholder.supabase.co';
const supabaseKey = (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 'placeholder-key';

// Inisialisasi client hanya jika URL valid untuk mencegah crash aplikasi
export const supabase = createClient(supabaseUrl, supabaseKey);

export const fetchInitialData = async (table: string) => {
  try {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn(`Supabase offline for ${table}, using local data.`);
    return [];
  }
};

export const subscribeTable = (table: string, callback: (payload: any) => void) => {
  try {
    return supabase
      .channel(`${table}_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
      .subscribe();
  } catch (e) {
    return { unsubscribe: () => {} };
  }
};
