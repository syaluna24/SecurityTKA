
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage, FullDatabase } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA GLOBAL SYNC ENGINE (v16.0 - PRODUCTION STABLE)
 * Menghubungkan Laptop & HP Satpam secara nyata melalui Cloud Relay.
 */

const getClusterName = () => localStorage.getItem('tka_cluster_name') || 'TKA-DEFAULT';
const getBlobID = () => localStorage.getItem('tka_blob_id');

// Data awal agar aplikasi tidak pernah blank
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

// API Relay untuk sinkronisasi antar perangkat (Laptop <-> HP)
const RELAY_API = "https://jsonblob.com/api/jsonBlob";

export const db = {
  getCluster: () => getClusterName(),
  
  // Fungsi untuk menyambungkan Laptop dan HP
  connectCluster: async (name: string) => {
    const cleanName = name.toUpperCase().replace(/\s/g, '');
    localStorage.setItem('tka_cluster_name', cleanName);
    
    // Discovery: Cari Blob ID yang sudah ada untuk cluster ini atau buat baru
    try {
      // Step 1: Cek apakah ID sudah tersimpan di browser
      let blobId = localStorage.getItem(`blob_id_${cleanName}`);
      
      if (!blobId) {
        // Step 2: Jika belum ada, buat "Awan" baru di Cloud Relay
        const res = await fetch(RELAY_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(INITIAL_DB)
        });
        const url = res.headers.get('Location');
        if (url) {
          blobId = url.split('/').pop() || '';
          localStorage.setItem(`blob_id_${cleanName}`, blobId);
        }
      }
      
      if (blobId) {
        localStorage.setItem('tka_blob_id', blobId);
        window.location.reload();
      }
    } catch (e) {
      console.error("Koneksi Gagal", e);
      alert("Gagal menyambung ke Cloud. Pastikan internet aktif.");
    }
  },

  // Ambil Data Terbaru dari Cloud
  fetch: async (): Promise<FullDatabase> => {
    const bId = getBlobID();
    if (!bId) {
      // Jika belum pairing, gunakan data lokal + mock
      const local = localStorage.getItem('tka_local_backup');
      return local ? JSON.parse(local) : INITIAL_DB;
    }

    try {
      const res = await fetch(`${RELAY_API}/${bId}`);
      if (res.ok) {
        const data = await res.json();
        // Backup untuk mode offline
        localStorage.setItem('tka_local_backup', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Cloud Sync Offline, menggunakan data lokal.");
    }
    
    const local = localStorage.getItem('tka_local_backup');
    return local ? JSON.parse(local) : INITIAL_DB;
  },

  // Simpan Data ke Cloud agar HP/Laptop lain langsung update
  push: async (updateFn: (db: FullDatabase) => FullDatabase) => {
    const bId = getBlobID();
    const current = await db.fetch();
    const updated = updateFn(current);
    updated.lastUpdated = new Date().toISOString();

    // Simpan ke lokal dulu (supaya cepat)
    localStorage.setItem('tka_local_backup', JSON.stringify(updated));

    // Kirim ke Cloud agar perangkat lain sinkron
    if (bId) {
      try {
        await fetch(`${RELAY_API}/${bId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } catch (e) {
        console.error("Cloud Push Gagal", e);
      }
    }
    return updated;
  },

  // API Methods yang dipanggil oleh App.tsx
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
