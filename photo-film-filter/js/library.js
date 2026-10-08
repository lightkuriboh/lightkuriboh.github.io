// web/js/library.js — Client-Side Persistent Image Library (IndexedDB)

class LibraryDB {
  constructor(dbName = 'film_magic_library', maxEntries = 500) {
    this.dbName = dbName;
    this.maxEntries = maxEntries;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('createdAt', 'createdAt', { unique: false });
          entryStore.createIndex('filterCategory', 'filterCategory', { unique: false });
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  async saveEntry({
    id = null,
    filterId,
    filterName,
    filterCategory = 'Film',
    adjustments = {},
    width = 0,
    height = 0,
    thumbnailDataUrl = '',
    fullResDataUrl = '',
  }) {
    await this.open();
    const entryId = id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    const entry = {
      id: entryId,
      filterId,
      filterName,
      filterCategory,
      adjustments,
      width,
      height,
      fileSizeBytes: fullResDataUrl ? Math.round((fullResDataUrl.length * 3) / 4) : 0,
      createdAt,
    };

    const imagePayload = {
      id: entryId,
      thumbnail: thumbnailDataUrl,
      fullRes: fullResDataUrl,
    };

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(['entries', 'images'], 'readwrite');
        tx.objectStore('entries').put(entry);
        tx.objectStore('images').put(imagePayload);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Enforce LRU eviction if count exceeds maxEntries
      await this._enforceLRU();
    }

    return entry;
  }

  async getEntries({ sortBy = 'createdAt', category = null, descending = true } = {}) {
    await this.open();
    if (!this.db) return [];

    const entries = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('entries', 'readonly');
      const store = tx.objectStore('entries');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    let filtered = entries;
    if (category && category !== 'All') {
      filtered = filtered.filter((e) => e.filterCategory === category);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'filterName') {
        cmp = (a.filterName || '').localeCompare(b.filterName || '');
      } else if (sortBy === 'fileSizeBytes') {
        cmp = (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return descending ? -cmp : cmp;
    });

    return filtered;
  }

  async getImage(id) {
    await this.open();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('images', 'readonly');
      const req = tx.objectStore('images').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteEntry(id) {
    await this.open();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['entries', 'images'], 'readwrite');
      tx.objectStore('entries').delete(id);
      tx.objectStore('images').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    await this.open();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['entries', 'images'], 'readwrite');
      tx.objectStore('entries').clear();
      tx.objectStore('images').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async _enforceLRU() {
    if (!this.db) return;
    const entries = await this.getEntries({ sortBy: 'createdAt', descending: false });
    if (entries.length > this.maxEntries) {
      const toRemove = entries.slice(0, entries.length - this.maxEntries);
      for (const e of toRemove) {
        await this.deleteEntry(e.id);
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LibraryDB };
}
