
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * TKA PRISMA-BROWSER CLIENT
 * Memberikan pengalaman coding Prisma di Frontend dengan sinkronisasi Cloud Real-time.
 */
export const db = {
  resident: {
    findMany: async () => {
      const { data } = await supabase.from('residents').select('*').order('name');
      return (data || []) as Resident[];
    },
    create: async (data: any) => {
      return await supabase.from('residents').insert(data);
    },
    update: async (id: string, data: any) => {
      return await supabase.from('residents').update(data).eq('id', id);
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('realtime:residents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, callback)
        .subscribe();
    }
  },
  incident: {
    findMany: async () => {
      const { data } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
      return (data || []) as IncidentReport[];
    },
    create: async (data: any) => {
      return await supabase.from('incidents').insert(data);
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('realtime:incidents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, callback)
        .subscribe();
    }
  },
  patrol: {
    findMany: async () => {
      const { data } = await supabase.from('patrol_logs').select('*').order('timestamp', { ascending: false });
      return (data || []) as PatrolLog[];
    },
    create: async (data: any) => {
      return await supabase.from('patrol_logs').insert(data);
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('realtime:patrol_logs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patrol_logs' }, callback)
        .subscribe();
    }
  },
  guest: {
    findMany: async () => {
      const { data } = await supabase.from('guests').select('*').order('entryTime', { ascending: false });
      return (data || []) as GuestLog[];
    },
    create: async (data: any) => {
      return await supabase.from('guests').insert(data);
    },
    update: async (id: string, data: any) => {
      return await supabase.from('guests').update(data).eq('id', id);
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('realtime:guests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, callback)
        .subscribe();
    }
  },
  chat: {
    findMany: async () => {
      const { data } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
      return (data || []) as ChatMessage[];
    },
    create: async (data: any) => {
      return await supabase.from('chat_messages').insert(data);
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('realtime:chat_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
        .subscribe();
    }
  }
};
