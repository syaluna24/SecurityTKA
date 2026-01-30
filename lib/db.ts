
import { supabase } from '../services/supabaseService.ts';
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage, User } from '../types.ts';

// Prisma-like interface for frontend usage
// Ini bertindak sebagai wrapper sehingga App.tsx bisa menggunakan db.resident.findMany()
export const db = {
  resident: {
    findMany: async () => {
      const { data } = await supabase.from('residents').select('*').order('name');
      return (data || []) as Resident[];
    },
    update: async (id: string, payload: Partial<Resident>) => {
      return supabase.from('residents').update(payload).eq('id', id);
    },
    create: async (payload: any) => {
      return supabase.from('residents').insert(payload);
    }
  },
  incident: {
    findMany: async () => {
      const { data } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
      return (data || []) as IncidentReport[];
    },
    create: async (payload: any) => {
      return supabase.from('incidents').insert(payload);
    }
  },
  patrol: {
    findMany: async () => {
      const { data } = await supabase.from('patrol_logs').select('*').order('timestamp', { ascending: false });
      return (data || []) as PatrolLog[];
    },
    create: async (payload: any) => {
      return supabase.from('patrol_logs').insert(payload);
    }
  },
  guest: {
    findMany: async () => {
      const { data } = await supabase.from('guests').select('*').order('entryTime', { ascending: false });
      return (data || []) as GuestLog[];
    },
    create: async (payload: any) => {
      return supabase.from('guests').insert(payload);
    }
  },
  chat: {
    findMany: async () => {
      const { data } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
      return (data || []) as ChatMessage[];
    },
    create: async (payload: any) => {
      return supabase.from('chat_messages').insert(payload);
    }
  }
};
