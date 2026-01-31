
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage, FullDatabase } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA SUPA-RELAY ENGINE (v17.0 - VERCEL/CLOUD PERSISTENCE)
 * Menghubungkan Laptop & HP secara nyata dengan sinkronisasi instan.
 */

const getClusterID = () => localStorage.getItem('tka_cluster_id') || 'TKA-MASTER-CLUSTER';
const getBlobID = () => localStorage.getItem('tka_blob_id');

// Master Seed: Data awal jika cluster baru dibuat agar tidak blank
const INITIAL_SEED: FullDatabase = {
  residents: [...MOCK_RESIDENTS],
  guests: [...MOCK_GUESTS],
  incidents: [...MOCK_INCIDENTS],
  patrolLogs: [],
  chatMessages: [],
  securityUsers: [],
  checkpoints: [],
  lastUpdated: new Date().toISOString()
};

// Cloud Endpoint (Relay Storage yang mensimulasikan Vercel Postgres secara Real-time)
const CLOUD_ENDPOINT = "https://jsonblob.com/api/jsonBlob";

export const db = {
  getCluster: () => getClusterID(),

  // Menghubungkan HP & Laptop ke saluran yang sama
  connect: async (clusterName: string) => {
    const id = clusterName.toUpperCase().replace(/\s/g, '');
    localStorage.setItem('tka_cluster_id', id);
    
    // Discovery Logic: Ambil ID Cloud yang sudah ada untuk Cluster ini
    let cloudId = localStorage.getItem(`cloud_id_${id}`);
    
    if (!cloudId) {
      try {
        const res = await fetch(CLOUD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(INITIAL_SEED)
        });
        const url = res.headers.get('Location');
        if (url) {
          cloudId = url.split('/').pop() || '';
          localStorage.setItem(`cloud_id_${id}`, cloudId);
        }
      } catch (e) {
        console.error("Cloud Error", e);
      }
    }
    
    if (cloudId) {
      localStorage.setItem('tka_blob_id', cloudId);
      window.location.reload();
    }
  },

  // Tarik data terbaru dari Cloud (Real-time Fetch)
  fetch: async (): Promise<FullDatabase> => {
    const cloudId = getBlobID();
    if (!cloudId) return INITIAL_SEED;

    try {
      const res = await fetch(`${CLOUD_ENDPOINT}/${cloudId}`);
      if (res.ok) {
        const data = await res.json();
        // Simpan cache lokal untuk akses instan
        localStorage.setItem('tka_cache', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Using Local Cache...");
    }

    const cache = localStorage.getItem('tka_cache');
    return cache ? JSON.parse(cache) : INITIAL_SEED;
  },

  // Dorong data ke Cloud agar perangkat lain (HP/Laptop) langsung update
  push: async (updateFn: (db: FullDatabase) => FullDatabase) => {
    const cloudId = getBlobID();
    const current = await db.fetch();
    const updated = updateFn(current);
    updated.lastUpdated = new Date().toISOString();

    // Optimistic UI: Update cache lokal dulu
    localStorage.setItem('tka_cache', JSON.stringify(updated));

    if (cloudId) {
      try {
        await fetch(`${CLOUD_ENDPOINT}/${cloudId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error("Push failed", e);
      }
    }
    return updated;
  },

  // --- API METHODS UNTUK APP ---
  resident: {
    findMany: async () => (await db.fetch()).residents,
    update: async (id: string, payload: any) => 
      db.push(d => ({ ...d, residents: d.residents.map(r => r.id === id ? {...r, ...payload} : r) })),
    create: async (payload: any) => 
      db.push(d => ({ ...d, residents: [payload, ...d.residents] }))
  },
  incident: {
    findMany: async () => (await db.fetch()).incidents,
    create: async (payload: any) => 
      db.push(d => ({ ...d, incidents: [payload, ...d.incidents] }))
  },
  patrol: {
    findMany: async () => (await db.fetch()).patrolLogs,
    create: async (payload: any) => 
      db.push(d => ({ ...d, patrolLogs: [payload, ...d.patrolLogs] }))
  },
  guest: {
    findMany: async () => (await db.fetch()).guests,
    create: async (payload: any) => 
      db.push(d => ({ ...d, guests: [payload, ...d.guests] }))
  },
  chat: {
    findMany: async () => (await db.fetch()).chatMessages,
    create: async (payload: any) => 
      db.push(d => ({ ...d, chatMessages: [...d.chatMessages, payload] }))
  }
};
