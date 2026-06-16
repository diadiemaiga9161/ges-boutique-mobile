import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalStoreService {
  setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  getItem<T = any>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}
