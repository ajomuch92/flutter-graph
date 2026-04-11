interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private ttl: number; // Time to live in milliseconds

  constructor(ttlMinutes: number = 60) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const cache = new MemoryCache(60); // 60 minutos de TTL