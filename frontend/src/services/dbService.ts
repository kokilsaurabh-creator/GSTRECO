import type { SapRawRecord, Gstr2bRawRecord } from '../data/mockDataFallback';
import type { RecoRecord } from '../data/mockData';

const DB_NAME = 'GSTRECO_BROWSER_DB';
const DB_VERSION = 1;

export interface StoredState {
  sap: SapRawRecord[];
  gstr2b: Gstr2bRawRecord[];
  reco: RecoRecord[];
}

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      if (!db.objectStoreNames.contains('sap_records')) {
        const sapStore = db.createObjectStore('sap_records', { keyPath: 'id' });
        sapStore.createIndex('gstin', 'gstin', { unique: false });
        sapStore.createIndex('return_period', 'return_period', { unique: false });
      }

      if (!db.objectStoreNames.contains('gstr2b_records')) {
        const gstrStore = db.createObjectStore('gstr2b_records', { keyPath: 'id' });
        gstrStore.createIndex('gstin', 'gstin', { unique: false });
        gstrStore.createIndex('return_period', 'return_period', { unique: false });
      }

      if (!db.objectStoreNames.contains('reco_results')) {
        const recoStore = db.createObjectStore('reco_results', { keyPath: 'id' });
        recoStore.createIndex('gstin', 'gstin', { unique: false });
        recoStore.createIndex('return_period', 'return_period', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result as IDBDatabase;
      resolve(dbInstance);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
};

export const dbService = {
  async saveSapRecords(records: SapRawRecord[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('sap_records', 'readwrite');
    const store = tx.objectStore('sap_records');
    records.forEach((r) => store.put(r));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveGstr2bRecords(records: Gstr2bRawRecord[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('gstr2b_records', 'readwrite');
    const store = tx.objectStore('gstr2b_records');
    records.forEach((r) => store.put(r));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveRecoResults(records: RecoRecord[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('reco_results', 'readwrite');
    const store = tx.objectStore('reco_results');
    records.forEach((r) => store.put(r));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearRecoResults(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('reco_results', 'readwrite');
    const store = tx.objectStore('reco_results');
    const request = store.clear();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAllSapRecords(): Promise<SapRawRecord[]> {
    const db = await openDB();
    const tx = db.transaction('sap_records', 'readonly');
    const store = tx.objectStore('sap_records');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllGstr2bRecords(): Promise<Gstr2bRawRecord[]> {
    const db = await openDB();
    const tx = db.transaction('gstr2b_records', 'readonly');
    const store = tx.objectStore('gstr2b_records');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllRecoResults(): Promise<RecoRecord[]> {
    const db = await openDB();
    const tx = db.transaction('reco_results', 'readonly');
    const store = tx.objectStore('reco_results');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async clearAllData(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(['sap_records', 'gstr2b_records', 'reco_results'], 'readwrite');
    tx.objectStore('sap_records').clear();
    tx.objectStore('gstr2b_records').clear();
    tx.objectStore('reco_results').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
