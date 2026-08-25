'use client'

// Offline chapter cache (Pillar 1) backed by IndexedDB. Lets a user
// re-open a chapter they've already extracted without a network call.

const DB_NAME = 'zenreader-chapters'
const STORE_NAME = 'chapters'
const DB_VERSION = 1

export interface StoredChapter {
  url: string
  title: string | null
  text: string
  prevUrl: string | null
  nextUrl: string | null
  savedAt: number
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveChapter(chapter: StoredChapter): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(chapter)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

export async function getChapter(url: string): Promise<StoredChapter | null> {
  const db = await openDb()
  if (!db) return null
  const result = await new Promise<StoredChapter | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(url)
      req.onsuccess = () => resolve((req.result as StoredChapter | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  db.close()
  return result
}
