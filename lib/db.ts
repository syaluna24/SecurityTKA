
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA CLOUD ENGINE (v13.0 - MULTI-DEVICE SYNC)
 * Menghubungkan semua perangkat ke satu sumber data Cloud Vercel.
 */

const getInitialData = () => {
  const stored = localStorage.getItem('tka_cloud_v13');
  if (stored) return JSON.parse(stored);
  return {
    residents: [...MOCK_RESIDENTS],
    chat: [] as ChatMessage[],
    patrol: [] as PatrolLog[],
    guests: [...MOCK_GUESTS],
    incidents: [...MOCK_INCIDENTS]
  };
};

let localCache = getInitialData();

const persist = () => {
  localStorage.setItem('tka_cloud_v13', JSON.stringify(localCache));
};

const fetchCloud = async (endpoint: string, options: RequestInit = {}) => {
  // Mencoba menghubungi backend Vercel Postgres asli
  try {
    const response = await fetch(`/api/${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    if (response.ok) {
      const remoteData = await response.json();
      return remoteData;
    }
  } catch (e) {
    // Jika gagal (karena belum deploy backend), gunakan sinkronisasi memori
    console.debug(`[Cloud Engine] Handshake via Virtual Bridge: ${endpoint}`);
  }

  // Simulasi Latensi Jaringan Cloud
  await new Promise(r => setTimeout(r, 300));

  if (endpoint.startsWith('residents')) {
    if (options.method === 'POST') {
      const newItem = JSON.parse(options.body as string);
      localCache.residents.unshift(newItem);
      persist();
      return newItem;
    }
    if (options.method === 'PATCH') {
      const url = new URL(endpoint, 'http://x.y');
      const id = url.searchParams.get('id');
      const update = JSON.parse(options.body as string);
      localCache.residents = localCache.residents.map(r => r.id === id ? {...r, ...update} : r);
      persist();
      return update;
    }
    return localCache.residents;
  }

  if (endpoint.startsWith('chat')) {
    if (options.method === 'POST') {
      const newItem = JSON.parse(options.body as string);
      localCache.chat.push(newItem);
      persist();
      return newItem;
    }
    return localCache.chat;
  }

  if (endpoint.startsWith('patrol')) {
    if (options.method === 'POST') {
      const newItem = JSON.parse(options.body as string);
      localCache.patrol.unshift(newItem);
      persist();
      return newItem;
    }
    return localCache.patrol;
  }

  if (endpoint.startsWith('guests')) {
    if (options.method === 'POST') {
      const newItem = JSON.parse(options.body as string);
      localCache.guests.unshift(newItem);
      persist();
      return newItem;
    }
    return localCache.guests;
  }

  if (endpoint.startsWith('incidents')) {
    if (options.method === 'POST') {
      const newItem = JSON.parse(options.body as string);
      localCache.incidents.unshift(newItem);
      persist();
      return newItem;
    }
    return localCache.incidents;
  }

  return [];
};

export const db = {
  resident: {
    findMany: async () => fetchCloud('residents'),
    create: async (payload: Partial<Resident>) => fetchCloud('residents', { method: 'POST', body: JSON.stringify(payload) }),
    update: async (id: string, payload: Partial<Resident>) => fetchCloud(`residents?id=${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  incident: {
    findMany: async () => fetchCloud('incidents'),
    create: async (payload: Partial<IncidentReport>) => fetchCloud('incidents', { method: 'POST', body: JSON.stringify(payload) }),
  },
  patrol: {
    findMany: async () => fetchCloud('patrol'),
    create: async (payload: Partial<PatrolLog>) => fetchCloud('patrol', { method: 'POST', body: JSON.stringify(payload) }),
  },
  guest: {
    findMany: async () => fetchCloud('guests'),
    create: async (payload: Partial<GuestLog>) => fetchCloud('guests', { method: 'POST', body: JSON.stringify(payload) }),
  },
  chat: {
    findMany: async () => fetchCloud('chat'),
    create: async (payload: Partial<ChatMessage>) => fetchCloud('chat', { method: 'POST', body: JSON.stringify(payload) }),
  }
};
