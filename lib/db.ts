
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * TKA PRISMA-CLOUD BRIDGE (v6.0)
 * Mengabstraksi koneksi ke database Vercel/Supabase dengan pola pemanggilan Prisma.
 */
export const db = {
  resident: {
    findMany: async () => {
      const { data, error } = await supabase.from('residents').select('*').order('block', { ascending: true });
      if (error) throw error;
      return (data || []) as Resident[];
    },
    create: async (payload: Partial<Resident>) => {
      const { data, error } = await supabase.from('residents').insert([payload]).select();
      if (error) throw error;
      return data[0] as Resident;
    },
    update: async (id: string, payload: Partial<Resident>) => {
      const { data, error } = await supabase.from('residents').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0] as Resident;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('db-residents')
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
    create: async (payload: Partial<IncidentReport>) => {
      const { data, error } = await supabase.from('incidents').insert([payload]).select();
      if (error) throw error;
      return data[0] as IncidentReport;
    },
    update: async (id: string, payload: Partial<IncidentReport>) => {
      const { data, error } = await supabase.from('incidents').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0] as IncidentReport;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('db-incidents')
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
    create: async (payload: Partial<PatrolLog>) => {
      const { data, error } = await supabase.from('patrol_logs').insert([payload]).select();
      if (error) throw error;
      return data[0] as PatrolLog;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('db-patrol')
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
    create: async (payload: Partial<GuestLog>) => {
      const { data, error } = await supabase.from('guests').insert([payload]).select();
      if (error) throw error;
      return data[0] as GuestLog;
    },
    update: async (id: string, payload: Partial<GuestLog>) => {
      const { data, error } = await supabase.from('guests').update(payload).eq('id', id).select();
      if (error) throw error;
      return data[0] as GuestLog;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('db-guests')
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
    create: async (payload: Partial<ChatMessage>) => {
      const { data, error } = await supabase.from('chat_messages').insert([payload]).select();
      if (error) throw error;
      return data[0] as ChatMessage;
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('db-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
        .subscribe();
    }
  }
};
