
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

// Helper untuk LocalStorage Fallback
const localDB = {
  get: (key: string) => JSON.parse(localStorage.getItem(`tka_fallback_${key}`) || '[]'),
  set: (key: string, data: any) => localStorage.setItem(`tka_fallback_${key}`, JSON.stringify(data)),
  save: (key: string, item: any) => {
    const list = localDB.get(key);
    const index = list.findIndex((i: any) => i.id === item.id);
    if (index > -1) list[index] = item; else list.unshift(item);
    localDB.set(key, list);
  },
  delete: (key: string, id: string) => {
    const list = localDB.get(key).filter((i: any) => i.id !== id);
    localDB.set(key, list);
  }
};

/**
 * TKA HYBRID-ENGINE (v7.0)
 * Mencoba akses Cloud (Supabase), jika gagal otomatis menggunakan Local Storage.
 */
export const db = {
  resident: {
    findMany: async () => {
      try {
        const { data, error } = await supabase.from('residents').select('*').order('block', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) localDB.set('residents', data);
        return (data || []) as Resident[];
      } catch (e) {
        return localDB.get('residents') as Resident[];
      }
    },
    create: async (payload: Partial<Resident>) => {
      localDB.save('residents', payload);
      try {
        const { data } = await supabase.from('residents').insert([payload]).select();
        return data ? data[0] : payload;
      } catch (e) {
        return payload;
      }
    },
    update: async (id: string, payload: Partial<Resident>) => {
      const current = localDB.get('residents').find((r: any) => r.id === id);
      const updated = { ...current, ...payload };
      localDB.save('residents', updated);
      try {
        await supabase.from('residents').update(payload).eq('id', id);
        return updated;
      } catch (e) {
        return updated;
      }
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase.channel('db-residents').on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, callback).subscribe();
    }
  },
  incident: {
    findMany: async () => {
      try {
        const { data, error } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        if (data) localDB.set('incidents', data);
        return (data || []) as IncidentReport[];
      } catch (e) {
        return localDB.get('incidents') as IncidentReport[];
      }
    },
    create: async (payload: Partial<IncidentReport>) => {
      localDB.save('incidents', payload);
      try {
        await supabase.from('incidents').insert([payload]);
        return payload;
      } catch (e) {
        return payload;
      }
    },
    update: async (id: string, payload: Partial<IncidentReport>) => {
      try { await supabase.from('incidents').update(payload).eq('id', id); } catch (e) {}
      return payload;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase.channel('db-incidents').on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, callback).subscribe();
    }
  },
  patrol: {
    findMany: async () => {
      try {
        const { data, error } = await supabase.from('patrol_logs').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return (data || []) as PatrolLog[];
      } catch (e) {
        return localDB.get('patrol_logs') as PatrolLog[];
      }
    },
    create: async (payload: Partial<PatrolLog>) => {
      localDB.save('patrol_logs', payload);
      try { await supabase.from('patrol_logs').insert([payload]); } catch (e) {}
      return payload;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase.channel('db-patrol').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patrol_logs' }, callback).subscribe();
    }
  },
  guest: {
    findMany: async () => {
      try {
        const { data, error } = await supabase.from('guests').select('*').order('entryTime', { ascending: false });
        if (error) throw error;
        return (data || []) as GuestLog[];
      } catch (e) {
        return localDB.get('guests') as GuestLog[];
      }
    },
    create: async (payload: Partial<GuestLog>) => {
      localDB.save('guests', payload);
      try { await supabase.from('guests').insert([payload]); } catch (e) {}
      return payload;
    },
    update: async (id: string, payload: Partial<GuestLog>) => {
      try { await supabase.from('guests').update(payload).eq('id', id); } catch (e) {}
      return payload;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase.channel('db-guests').on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, callback).subscribe();
    }
  },
  chat: {
    findMany: async () => {
      try {
        const { data, error } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
        if (error) throw error;
        return (data || []) as ChatMessage[];
      } catch (e) {
        return localDB.get('chat_messages') as ChatMessage[];
      }
    },
    create: async (payload: Partial<ChatMessage>) => {
      localDB.save('chat_messages', payload);
      try { await supabase.from('chat_messages').insert([payload]); } catch (e) {}
      return payload;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase.channel('db-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback).subscribe();
    }
  }
};
