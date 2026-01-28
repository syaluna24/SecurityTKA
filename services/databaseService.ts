
import { FullDatabase } from '../types';

export const DatabaseService = {
  KEYS: {
    MASTER_DB: 'tka_master_db_v2',
  },

  // Inisialisasi Database dengan proteksi data kosong
  getDatabase: (initialData: FullDatabase): FullDatabase => {
    const saved = localStorage.getItem(DatabaseService.KEYS.MASTER_DB);
    if (!saved) {
      DatabaseService.saveDatabase(initialData);
      return initialData;
    }
    try {
      const parsed = JSON.parse(saved);
      // Pastikan semua field ada
      return {
        ...initialData,
        ...parsed,
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    } catch (e) {
      console.error("Database Corrupted, resetting...");
      return initialData;
    }
  },

  saveDatabase: (db: FullDatabase): void => {
    db.lastUpdated = new Date().toISOString();
    localStorage.setItem(DatabaseService.KEYS.MASTER_DB, JSON.stringify(db));
  },

  // Menghasilkan Kode Master untuk Sinkronisasi
  exportSyncCode: (): string => {
    const db = localStorage.getItem(DatabaseService.KEYS.MASTER_DB);
    if (!db) return "";
    // Menggunakan btoa + encodeURIComponent agar karakter aman saat dikirim via chat
    return btoa(encodeURIComponent(db));
  },

  // Mengimpor data dari Kode Master
  importSyncCode: (code: string): boolean => {
    try {
      const decoded = decodeURIComponent(atob(code));
      const importedDb: FullDatabase = JSON.parse(decoded);
      
      // Validasi struktur minimal agar tidak crash
      if (Array.isArray(importedDb.residents)) {
        DatabaseService.saveDatabase(importedDb);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Invalid Sync Code", e);
      return false;
    }
  }
};
