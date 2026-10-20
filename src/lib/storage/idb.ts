/**
 * Tiny IndexedDB key-value helpers. Everything the lifter imports or
 * approves lives here, in this browser only.
 */

const DB_NAME = "blueprint";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const idbGet = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const idbPut = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const idbDelete = (key: string) => run("readwrite", (s) => s.delete(key));

/**
 * A localStorage flag that says a record exists, so the first render knows
 * to wait for IndexedDB instead of flashing the sample data.
 */
export function readFlag(name: string) {
  try {
    return localStorage.getItem(name) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(name: string, on: boolean) {
  try {
    if (on) localStorage.setItem(name, "1");
    else localStorage.removeItem(name);
  } catch {
    // Storage blocked: the change still applies for this page view.
  }
}
