
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';

/**
 * TKA VERCEL-POSTGRES BRIDGE (v9.0)
 * Fokus sepenuhnya pada integrasi Vercel Postgres melalui API Routes.
 * Catatan: Membutuhkan backend Serverless Functions di folder /api yang menggunakan Prisma.
 */

const fetchCloud = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Vercel API Error: ${response.status}`);
  }
  
  return response.json();
};

export const db = {
  resident: {
    findMany: async () => fetchCloud('residents'),
    create: async (payload: Partial<Resident>) => fetchCloud('residents', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<Resident>) => fetchCloud(`residents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    delete: async (id: string) => fetchCloud(`residents/${id}`, { method: 'DELETE' }),
    // Simulasi Polling untuk Real-time di Vercel (karena Vercel Postgres tidak memiliki Real-time SDK bawaan)
    subscribe: (callback: (payload: any) => void) => {
      const interval = setInterval(async () => {
        try {
          const data = await fetchCloud('residents/updates'); // Endpoint imajiner untuk polling
          if (data && data.length > 0) {
            data.forEach((update: any) => callback({ eventType: 'UPDATE', new: update }));
          }
        } catch (e) { /* silent poll error */ }
      }, 5000);
      return { unsubscribe: () => clearInterval(interval) };
    }
  },
  incident: {
    findMany: async () => fetchCloud('incidents'),
    create: async (payload: Partial<IncidentReport>) => fetchCloud('incidents', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<IncidentReport>) => fetchCloud(`incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    subscribe: (callback: (payload: any) => void) => ({ unsubscribe: () => {} })
  },
  patrol: {
    findMany: async () => fetchCloud('patrol'),
    create: async (payload: Partial<PatrolLog>) => fetchCloud('patrol', { method: 'POST', body: JSON.stringify(payload) }),
    subscribe: (callback: (payload: any) => void) => ({ unsubscribe: () => {} })
  },
  guest: {
    findMany: async () => fetchCloud('guests'),
    create: async (payload: Partial<GuestLog>) => fetchCloud('guests', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<GuestLog>) => fetchCloud(`guests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    subscribe: (callback: (payload: any) => void) => ({ unsubscribe: () => {} })
  },
  chat: {
    findMany: async () => fetchCloud('chat'),
    create: async (payload: Partial<ChatMessage>) => fetchCloud('chat', { method: 'POST', body: JSON.stringify(payload) }),
    subscribe: (callback: (payload: any) => void) => {
       // Chat di Vercel biasanya menggunakan Pusher atau Ably, ini fallback poller
       const interval = setInterval(async () => {
         try {
           const data = await fetchCloud('chat/new');
           if (data && data.length > 0) {
             data.forEach((msg: any) => callback({ eventType: 'INSERT', new: msg }));
           }
         } catch (e) {}
       }, 3000);
       return { unsubscribe: () => clearInterval(interval) };
    }
  }
};
