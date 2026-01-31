
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage, FullDatabase } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA GLOBAL SYNC ENGINE (v15.0 - PRODUCTION BRIDGE)
 * Sistem ini menghubungkan Laptop & HP Satpam secara nyata.
 */

const getClusterID = () => localStorage.getItem('tka_cluster_id') || 'TKA-DEFAULT';
const getBlobID = () => localStorage.getItem('tka_blob_id');

// Inisialisasi Database Default
const INITIAL_DB: FullDatabase = {
  residents: [...MOCK_RESIDENTS],
  guests: [...MOCK_GUESTS],
  incidents: [...MOCK_INCIDENTS],
  patrolLogs: [],
  chatMessages: [],
  securityUsers: [],
  checkpoints: [],
  lastUpdated: new Date().toISOString()
};

// RELAY ENGINE: Menggunakan Public JSON Bridge (JSONBlob API)
// Ini memungkinkan sinkronisasi antar perangkat tanpa backend sendiri.
const RELAY_API = "https://jsonblob.com/api/jsonBlob";

export const db = {
  getCluster: () => getClusterID(),
  
  // Fungsi Utama untuk Menghubungkan Perangkat
  connect: async (clusterName: string) => {
    localStorage.setItem('tka_cluster_id', clusterName);
    
    // Cari apakah cluster sudah punya Blob ID di "Cloud Discovery"
    // Untuk demo ini, kita gunakan pendekatan Cluster Name sebagai ID di local storage
    // Namun tetap melakukan fetch dari cloud jika ID tersedia.
    let blobId = localStorage.getItem(`blob_${clusterName}`);
    
    if (!blobId) {
      // Buat "Awan" baru untuk Cluster ini
      try {
        const res = await fetch(RELAY_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(INITIAL_DB)
        });
        const url = res.headers.get('Location');
        if (url) {
          blobId = url.split('/').pop() || '';
          localStorage.setItem(`blob_${clusterName}`, blobId);
          localStorage.setItem('tka_blob_id', blobId);
        }
      } catch (e) {
        console.error("Cloud Error", e);
      }
    } else {
      localStorage.setItem('tka_blob_id', blobId);
    }
    window.location.reload();
  },

  // Ambil Data dari Awan
  fetchGlobal: async (): Promise<FullDatabase> => {
    const bId = getBlobID();
    if (!bId) return INITIAL_DB;

    try {
      const res = await fetch(`${RELAY_API}/${bId}`);
      if (res.ok) {
        const data = await res.json();
        // Simpan ke local sebagai cache tercepat
        localStorage.setItem('tka_local_cache', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Cloud Syncing... using cache");
    }
    
    const cache = localStorage.getItem('tka_local_cache');
    return cache ? JSON.parse(cache) : INITIAL_DB;
  },

  // Simpan Data ke Awan (Agar HP & Laptop Update Bersamaan)
  pushGlobal: async (updateFn: (db: FullDatabase) => FullDatabase) => {
    const bId = getBlobID();
    const current = await db.fetchGlobal();
    const updated = updateFn(current);
    updated.lastUpdated = new Date().toISOString();

    // Update Local First (Fast UI)
    localStorage.setItem('tka_local_cache', JSON.stringify(updated));

    // Push to Cloud (Sync Devices)
    if (bId) {
      try {
        await fetch(`${RELAY_API}/${bId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error("Sync Failed", e);
      }
    }
    return updated;
  },

  // API Methods
  resident: {
    findMany: async () => (await db.fetchGlobal()).residents,
    update: async (id: string, payload: any) => 
      db.pushGlobal(d => ({ ...d, residents: d.residents.map(r => r.id === id ? {...r, ...payload} : r) })),
    create: async (payload: any) => 
      db.pushGlobal(d => ({ ...d, residents: [payload, ...d.residents] }))
  },
  incident: {
    findMany: async () => (await db.fetchGlobal()).incidents,
    create: async (payload: any) => 
      db.pushGlobal(d => ({ ...d, incidents: [payload, ...d.incidents] }))
  },
  patrol: {
    findMany: async () => (await db.fetchGlobal()).patrolLogs,
    create: async (payload: any) => 
      db.pushGlobal(d => ({ ...d, patrolLogs: [payload, ...d.patrolLogs] }))
  },
  guest: {
    findMany: async () => (await db.fetchGlobal()).guests,
    create: async (payload: any) => 
      db.pushGlobal(d => ({ ...d, guests: [payload, ...d.guests] }))
  },
  chat: {
    findMany: async () => (await db.fetchGlobal()).chatMessages,
    create: async (payload: any) => 
      db.pushGlobal(d => ({ ...d, chatMessages: [...d.chatMessages, payload] }))
  }
};
