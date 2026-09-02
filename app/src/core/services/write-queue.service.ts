import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface QueuedWrite {
  id?: number;
  createdAt: number;
  kind: 'create' | 'update' | 'delete';
  database: string;
  layout: string;
  recordId?: string;
  fieldData?: Record<string, unknown>;
  portalData?: Record<string, unknown[]>;
  attempts: number;
  lastError?: string;
}

interface FedirQueueDB extends DBSchema {
  writes: {
    key: number;
    value: QueuedWrite;
    indexes: { byCreatedAt: number };
  };
}

@Injectable({ providedIn: 'root' })
export class WriteQueueService {
  private dbPromise: Promise<IDBPDatabase<FedirQueueDB>> | null = null;

  private db(): Promise<IDBPDatabase<FedirQueueDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FedirQueueDB>('fedir-queue', 1, {
        upgrade(db) {
          const store = db.createObjectStore('writes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('byCreatedAt', 'createdAt');
        },
      });
    }
    return this.dbPromise;
  }

  async enqueue(entry: Omit<QueuedWrite, 'id' | 'createdAt' | 'attempts'>): Promise<number> {
    const db = await this.db();
    const value: QueuedWrite = {
      ...entry,
      createdAt: Date.now(),
      attempts: 0,
    } as QueuedWrite;
    return db.add('writes', value);
  }

  async list(): Promise<QueuedWrite[]> {
    const db = await this.db();
    return db.getAllFromIndex('writes', 'byCreatedAt');
  }

  async count(): Promise<number> {
    const db = await this.db();
    return db.count('writes');
  }

  async remove(id: number): Promise<void> {
    const db = await this.db();
    await db.delete('writes', id);
  }

  async update(id: number, patch: Partial<QueuedWrite>): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('writes', 'readwrite');
    const cur = await tx.store.get(id);
    if (!cur) return;
    await tx.store.put({ ...cur, ...patch });
    await tx.done;
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.clear('writes');
  }
}
