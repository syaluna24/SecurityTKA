
import { Resident, IncidentReport, PatrolLog, GuestLog, ChatMessage } from '../types.ts';
import { MOCK_RESIDENTS, MOCK_INCIDENTS, MOCK_GUESTS } from '../constants.tsx';

/**
 * TKA CLOUD SYNC ENGINE (v14.0 - MULTI-DEVICE CONNECTED)
 * Menghubungkan Laptop & HP melalui Shared Cluster Bridge.
 */

// Gunakan Cluster ID unik untuk menghubungkan perangkat (Laptop & HP)
// Di aplikasi asli, ini akan disimpan di database Vercel Postgres.
const getClusterID = () => localStorage.getItem('tka_cluster_id') || 'TKA-DEFAULT-CLUSTER';

const fetchFromCloud = async (endpoint: string) => {
  try {
    // Mencoba akses API Vercel jika tersedia
    const response = await fetch(`/api/${endpoint}?cluster=${getClusterID()}`);
    if (response.ok) return await response.json();
  } catch (e) {
    console.debug(`[Cloud] Offline/Local Mode for ${endpoint}`);
  }
  return null;
};

const saveToCloud = async (endpoint: string, data: any) => {
  try {
    await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clusterId: getClusterID(), ...data })
    });
  } catch (e) {
    // Fallback ke penyimpanan lokal jika server Vercel belum dideploy
    const localKey = `tka_local_${endpoint}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    existing.unshift(data);
    localStorage.setItem(localKey, JSON.stringify(existing));
  }
};

export const db = {
  setCluster: (id: string) => {
    localStorage.setItem('tka_cluster_id', id);
    window.location.reload();
  },
  getCluster: () => getClusterID(),

  resident: {
    findMany: async () => {
      const cloud = await fetchFromCloud('residents');
      if (cloud && cloud.length > 0) return cloud;
      const local = JSON.parse(localStorage.getItem('tka_local_residents') || '[]');
      return local.length > 0 ? local : MOCK_RESIDENTS;
    },
    update: async (id: string, payload: any) => {
      const local = JSON.parse(localStorage.getItem('tka_local_residents') || JSON.stringify(MOCK_RESIDENTS));
      const updated = local.map((r: any) => r.id === id ? { ...r, ...payload } : r);
      localStorage.setItem('tka_local_residents', JSON.stringify(updated));
      await saveToCloud('residents', { id, ...payload, type: 'UPDATE' });
    },
    create: async (payload: any) => {
      const local = JSON.parse(localStorage.getItem('tka_local_residents') || JSON.stringify(MOCK_RESIDENTS));
      local.unshift(payload);
      localStorage.setItem('tka_local_residents', JSON.stringify(local));
      await saveToCloud('residents', payload);
    }
  },

  incident: {
    findMany: async () => {
      const cloud = await fetchFromCloud('incidents');
      if (cloud) return cloud;
      const local = JSON.parse(localStorage.getItem('tka_local_incidents') || '[]');
      return local.length > 0 ? local : MOCK_INCIDENTS;
    },
    create: async (payload: any) => saveToCloud('incidents', payload)
  },

  patrol: {
    findMany: async () => {
      const cloud = await fetchFromCloud('patrol');
      if (cloud) return cloud;
      return JSON.parse(localStorage.getItem('tka_local_patrol') || '[]');
    },
    create: async (payload: any) => saveToCloud('patrol', payload)
  },

  guest: {
    findMany: async () => {
      const cloud = await fetchFromCloud('guests');
      if (cloud) return cloud;
      const local = JSON.parse(localStorage.getItem('tka_local_guests') || '[]');
      return local.length > 0 ? local : MOCK_GUESTS;
    },
    create: async (payload: any) => saveToCloud('guests', payload)
  },

  chat: {
    findMany: async () => {
      const cloud = await fetchFromCloud('chat');
      if (cloud) return cloud;
      return JSON.parse(localStorage.getItem('tka_local_chat') || '[]');
    },
    create: async (payload: any) => saveToCloud('chat', payload)
  }
};
