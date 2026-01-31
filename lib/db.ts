
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage, FullDatabase } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA GLOBAL CLOUD ENGINE
 * Menghubungkan Laptop & HP Satpam secara nyata.
 */

const getClusterName = () => localStorage.getItem('tka_cluster_name') || 'TKA-DEFAULT-CLUSTER';
const getBlobID = () => localStorage.getItem('tka_blob_id');

// Inisialisasi Database agar aplikasi tidak blank
const INITIAL_DATABASE: FullDatabase = {
  residents: [...MOCK_RESIDENTS],
  guests: [...MOCK_GUESTS],
  incidents: [...MOCK_INCIDENTS],
  patrolLogs: [],
  chatMessages: [],
  securityUsers: [],
  checkpoints: [],
  lastUpdated: new Date().toISOString()
};

// Cloud Relay API (Simulasi Database Vercel yang bisa diakses publik)
const RELAY_URL = "https://jsonblob.com/api/jsonBlob";

export const db = {
  getCluster: () => getClusterName(),
  
  // Fungsi Utama: Menghubungkan HP & Laptop
  connectCluster: async (name: string) => {
    const clusterId = name.toUpperCase().replace(/\s/g, '');
    localStorage.setItem('tka_cluster_name', clusterId);
    
    // Cari apakah cluster ini sudah punya ID cloud atau buat baru
    let blobId = localStorage.getItem(`blob_id_${clusterId}`);
    
    try {
      if (!blobId) {
        const res = await fetch(RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(INITIAL_DATABASE)
        });
        const url = res.headers.get('Location');
        if (url) {
          blobId = url.split('/').pop() || '';
          localStorage.setItem(`blob_id_${clusterId}`, blobId);
        }
      }
      
      if (blobId) {
        localStorage.setItem('tka_blob_id', blobId);
        window.location.reload();
      }
    } catch (e) {
      console.error("Gagal koneksi cloud database.");
    }
  },

  // Ambil Data Terbaru dari Cloud
  fetch: async (): Promise<FullDatabase> => {
    const id = getBlobID();
    if (!id) return INITIAL_DATABASE;

    try {
      const res = await fetch(`${RELAY_URL}/${id}`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('tka_local_cache', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Cloud offline, menggunakan cache lokal.");
    }
    
    const cache = localStorage.getItem('tka_local_cache');
    return cache ? JSON.parse(cache) : INITIAL_DATABASE;
  },

  // Update Data ke Cloud (Agar HP & Laptop sinkron seketika)
  push: async (updateFn: (db: FullDatabase) => FullDatabase) => {
    const id = getBlobID();
    const current = await db.fetch();
    const updated = updateFn(current);
    updated.lastUpdated = new Date().toISOString();

    // Simpan di lokal untuk kecepatan UI
    localStorage.setItem('tka_local_cache', JSON.stringify(updated));

    if (id) {
      try {
        await fetch(`${RELAY_URL}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error("Gagal sinkronisasi cloud.");
      }
    }
    return updated;
  },

  // Database Accessors
  resident: {
    findMany: async () => (await db.fetch()).residents || [],
    update: async (id: string, payload: any) => 
      db.push(d => ({ ...d, residents: (d.residents || []).map(r => r.id === id ? {...r, ...payload} : r) })),
    create: async (payload: any) => 
      db.push(d => ({ ...d, residents: [payload, ...(d.residents || [])] }))
  },
  incident: {
    findMany: async () => (await db.fetch()).incidents || [],
    create: async (payload: any) => 
      db.push(d => ({ ...d, incidents: [payload, ...(d.incidents || [])] }))
  },
  patrol: {
    findMany: async () => (await db.fetch()).patrolLogs || [],
    create: async (payload: any) => 
      db.push(d => ({ ...d, patrolLogs: [payload, ...(d.patrolLogs || [])] }))
  },
  guest: {
    findMany: async () => (await db.fetch()).guests || [],
    create: async (payload: any) => 
      db.push(d => ({ ...d, guests: [payload, ...(d.guests || [])] }))
  },
  chat: {
    findMany: async () => (await db.fetch()).chatMessages || [],
    create: async (payload: any) => 
      db.push(d => ({ ...d, chatMessages: [...(d.chatMessages || []), payload] }))
  }
};
