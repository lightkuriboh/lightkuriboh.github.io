import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LibraryDB } = require('../js/library.js');

class MockIDBStore {
  constructor() {
    this.data = new Map();
  }
  put(val) {
    this.data.set(val.id, JSON.parse(JSON.stringify(val)));
  }
  get(id) {
    const res = this.data.get(id);
    const req = { result: res ? JSON.parse(JSON.stringify(res)) : null };
    queueMicrotask(() => req.onsuccess && req.onsuccess());
    return req;
  }
  getAll() {
    const res = Array.from(this.data.values()).map((v) => JSON.parse(JSON.stringify(v)));
    const req = { result: res };
    queueMicrotask(() => req.onsuccess && req.onsuccess());
    return req;
  }
  delete(id) {
    this.data.delete(id);
  }
  clear() {
    this.data.clear();
  }
}

class MockIDBDatabase {
  constructor() {
    this.objectStoreNames = {
      contains: (name) => name === 'entries' || name === 'images',
    };
    this.stores = {
      entries: new MockIDBStore(),
      images: new MockIDBStore(),
    };
  }

  transaction(storeNames, mode) {
    const db = this;
    const tx = {
      objectStore: (name) => db.stores[name],
      oncomplete: null,
      onerror: null,
    };
    queueMicrotask(() => tx.oncomplete && tx.oncomplete());
    return tx;
  }
}

function setupMockIndexedDB() {
  const mockDb = new MockIDBDatabase();
  global.indexedDB = {
    open: (name, version) => {
      const req = {
        result: mockDb,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (req.onsuccess) req.onsuccess({ target: { result: mockDb } });
      });
      return req;
    },
  };
  return mockDb;
}

test('LibraryDB - saveEntry stores metadata and images correctly', async () => {
  setupMockIndexedDB();
  const lib = new LibraryDB('test_lib', 10);

  const entry = await lib.saveEntry({
    id: 'test_1',
    filterId: 1,
    filterName: 'Kodak Portra 400',
    filterCategory: 'Film',
    adjustments: { intensity: 1.0 },
    width: 800,
    height: 600,
    thumbnailDataUrl: 'data:image/jpeg;base64,thumb123',
    fullResDataUrl: 'data:image/png;base64,full123',
  });

  assert.strictEqual(entry.id, 'test_1');
  assert.strictEqual(entry.filterName, 'Kodak Portra 400');
  assert.strictEqual(entry.width, 800);

  const entries = await lib.getEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].id, 'test_1');

  const img = await lib.getImage('test_1');
  assert.ok(img);
  assert.strictEqual(img.thumbnail, 'data:image/jpeg;base64,thumb123');
  assert.strictEqual(img.fullRes, 'data:image/png;base64,full123');
});

test('LibraryDB - getEntries supports sorting and category filtering', async () => {
  setupMockIndexedDB();
  const lib = new LibraryDB('test_lib', 10);

  await lib.saveEntry({
    id: 'e_film',
    filterId: 1,
    filterName: 'Kodak Portra 400',
    filterCategory: 'Film',
    width: 100,
    height: 100,
    fullResDataUrl: 'data:image/png;base64,aaa',
  });

  await lib.saveEntry({
    id: 'e_effect',
    filterId: 16,
    filterName: 'Lush Natural Green',
    filterCategory: 'Effect',
    width: 100,
    height: 100,
    fullResDataUrl: 'data:image/png;base64,bbbbbb',
  });

  // Category filtering
  const filmOnly = await lib.getEntries({ category: 'Film' });
  assert.strictEqual(filmOnly.length, 1);
  assert.strictEqual(filmOnly[0].id, 'e_film');

  const effectOnly = await lib.getEntries({ category: 'Effect' });
  assert.strictEqual(effectOnly.length, 1);
  assert.strictEqual(effectOnly[0].id, 'e_effect');

  // Sort by filterName ascending
  const sortedName = await lib.getEntries({ sortBy: 'filterName', descending: false });
  assert.strictEqual(sortedName[0].filterName, 'Kodak Portra 400');
  assert.strictEqual(sortedName[1].filterName, 'Lush Natural Green');
});

test('LibraryDB - deleteEntry removes item and image', async () => {
  setupMockIndexedDB();
  const lib = new LibraryDB('test_lib', 10);

  await lib.saveEntry({
    id: 'to_delete',
    filterId: 2,
    filterName: 'Kodak Tri-X 400',
    thumbnailDataUrl: 'thumb',
    fullResDataUrl: 'full',
  });

  const deleted = await lib.deleteEntry('to_delete');
  assert.strictEqual(deleted, true);

  const entries = await lib.getEntries();
  assert.strictEqual(entries.length, 0);

  const img = await lib.getImage('to_delete');
  assert.strictEqual(img, null);
});

test('LibraryDB - LRU eviction automatically purges oldest entries when budget exceeded', async () => {
  setupMockIndexedDB();
  const lib = new LibraryDB('test_lib', 2); // Max 2 entries

  await lib.saveEntry({ id: 'item_1', filterId: 1, filterName: 'F1' });
  await lib.saveEntry({ id: 'item_2', filterId: 2, filterName: 'F2' });

  let entries = await lib.getEntries();
  assert.strictEqual(entries.length, 2);

  // Third entry triggers eviction of item_1
  await lib.saveEntry({ id: 'item_3', filterId: 3, filterName: 'F3' });

  entries = await lib.getEntries();
  assert.strictEqual(entries.length, 2);
  assert.ok(entries.some((e) => e.id === 'item_3'));
  assert.ok(entries.some((e) => e.id === 'item_2'));
  assert.ok(!entries.some((e) => e.id === 'item_1'));
});

test('LibraryDB - clearAll, sorting by size, and edge cases', async () => {
  setupMockIndexedDB();
  const lib = new LibraryDB('test_lib', 10);

  await lib.saveEntry({ id: 'small', filterId: 1, filterName: 'Small', fullResDataUrl: 'data:image/png;base64,12' });
  await lib.saveEntry({ id: 'large', filterId: 2, filterName: 'Large', fullResDataUrl: 'data:image/png;base64,12345678' });

  // Sort by fileSizeBytes ascending
  const sorted = await lib.getEntries({ sortBy: 'fileSizeBytes', descending: false });
  assert.strictEqual(sorted[0].id, 'small');
  assert.strictEqual(sorted[1].id, 'large');

  // clearAll
  await lib.clearAll();
  const empty = await lib.getEntries();
  assert.strictEqual(empty.length, 0);

  // Test when indexedDB is undefined
  const origIDB = global.indexedDB;
  delete global.indexedDB;
  const noIDBLib = new LibraryDB();
  const res = await noIDBLib.open();
  assert.strictEqual(res, null);
  assert.deepStrictEqual(await noIDBLib.getEntries(), []);
  assert.strictEqual(await noIDBLib.getImage('id'), null);
  assert.strictEqual(await noIDBLib.deleteEntry('id'), false);
  await noIDBLib.clearAll();
  global.indexedDB = origIDB;

  // Test onupgradeneeded and onerror branches
  let createdStores = [];
  const fakeDB = {
    objectStoreNames: { contains: (n) => false },
    createObjectStore: (name) => {
      createdStores.push(name);
      return { createIndex: () => {} };
    }
  };
  global.indexedDB = {
    open: () => {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: fakeDB } });
        if (req.onsuccess) req.onsuccess({ target: { result: fakeDB } });
      }, 0);
      return req;
    }
  };
  const upgradeLib = new LibraryDB('upgrade_test');
  await upgradeLib.open();
  assert.ok(createdStores.includes('entries'));
  assert.ok(createdStores.includes('images'));

  // Test onerror
  global.indexedDB = {
    open: () => {
      const req = { onerror: null };
      setTimeout(() => {
        if (req.onerror) req.onerror({ target: { error: new Error('IDB open failed') } });
      }, 0);
      return req;
    }
  };
  const errLib = new LibraryDB('err_test');
  await assert.rejects(async () => errLib.open(), /IDB open failed/);
  global.indexedDB = origIDB;
});
