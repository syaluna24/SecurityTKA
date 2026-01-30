
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * PRISMA-LIKE BROWSER CLIENT
 * Memberikan pengalaman coding Prisma di Frontend dengan sinkronisasi Cloud Supabase
 */
export const db = {
  resident: {
    findMany: async () => {
      const { data } = await supabase.from('residents').select('*').order('name');
      return (data || []) as Resident[];
    },
    create: async (data: Partial<Resident>) => {
      return await supabase.from('residents').insert(data).select().single();
    },
    update: async (id: string, data: Partial<Resident>) => {
      return await supabase.from('residents').update(data).eq('id', id).select().single();
    },
    delete: async (id: string) => {
      return await supabase.from('residents').delete().eq('id', id);
    },
    // Custom Real-time hook
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:residents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, callback)
        .subscribe();
    }
  },
  incident: {
    findMany: async () => {
      const { data } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
      return (data || []) as IncidentReport[];
    },
    create: async (data: Partial<IncidentReport>) => {
      return await supabase.from('incidents').insert(data).select().single();
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
      const { data } = await supabase.from('patrol_logs').select('*').order('timestamp', { ascending: false });
      return (data || []) as PatrolLog[];
    },
    create: async (data: Partial<PatrolLog>) => {
      return await supabase.from('patrol_logs').insert(data).select().single();
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:patrol_logs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patrol_logs' }, callback)
        .subscribe();
    }
  },
  chat: {
    findMany: async () => {
      const { data } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
      return (data || []) as ChatMessage[];
    },
    create: async (data: Partial<ChatMessage>) => {
      return await supabase.from('chat_messages').insert(data).select().single();
    },
    subscribe: (callback: (payload: any) => void) => {
      return supabase
        .channel('public:chat_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
        .subscribe();
    }
  }
};
