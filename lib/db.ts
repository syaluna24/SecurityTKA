
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * TKA PRISMA-ENGINE CLIENT (v4.0)
 * Sinkronisasi penuh dengan Supabase Realtime untuk semua modul.
 */
export const db = {
  resident: {
    findMany: async () => {
      const { data, error } = await supabase.from('residents').select('*').order('block', { ascending: true });
      if (error) throw error;
      return (data || []) as Resident[];
    },
    create: async (payload: any) => {
      const { data, error } = await supabase.from('residents').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id: string, payload: any) => {
      const { data, error } = await supabase.from('residents').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('residents').delete().eq('id', id);
      if (error) throw error;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:residents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, callback)
        .subscribe();
    }
  },
  incident: {
    findMany: async () => {
      const { data, error } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []) as IncidentReport[];
    },
    create: async (payload: any) => {
      const { data, error } = await supabase.from('incidents').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id: string, payload: any) => {
      const { data, error } = await supabase.from('incidents').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:incidents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, callback)
        .subscribe();
    }
  },
  patrol: {
    findMany: async () => {
      const { data, error } = await supabase.from('patrol_logs').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []) as PatrolLog[];
    },
    create: async (payload: any) => {
      const { data, error } = await supabase.from('patrol_logs').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:patrol_logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patrol_logs' }, callback)
        .subscribe();
    }
  },
  guest: {
    findMany: async () => {
      const { data, error } = await supabase.from('guests').select('*').order('entryTime', { ascending: false });
      if (error) throw error;
      return (data || []) as GuestLog[];
    },
    create: async (payload: any) => {
      const { data, error } = await supabase.from('guests').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id: string, payload: any) => {
      const { data, error } = await supabase.from('guests').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:guests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, callback)
        .subscribe();
    }
  },
  chat: {
    findMany: async () => {
      const { data, error } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    create: async (payload: any) => {
      const { data, error } = await supabase.from('chat_messages').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:chat_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
        .subscribe();
    }
  }
};
