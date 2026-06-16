import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BoutiqueInfo {
  id?: number;
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  logoUrl?: string;
  logoPath?: string;
  devise?: string;
  description?: string;
  numeroRc?: string;
  numeroIfu?: string;
  ville?: string;
  pays?: string;
}

const DEFAULT_BOUTIQUE: BoutiqueInfo = {
  nom: 'Boutique Alimentation',
  adresse: '',
  telephone: '',
  email: '',
  devise: 'FCFA'
};

@Injectable({
  providedIn: 'root'
})
export class BoutiqueService {
  private readonly apiUrl = `${environment.apiUrl}/boutique`;
  private readonly storeKey = 'boutique_info';
  private infoSubject = new BehaviorSubject<BoutiqueInfo>(this.readLocalInfo());

  info$ = this.infoSubject.asObservable();

  constructor(private http: HttpClient) {}

  getInfo(): BoutiqueInfo {
    return this.infoSubject.value;
  }

  getLogoPath(): string {
    return this.getInfo().logoUrl || 'assets/icon/favicon.png';
  }

  refreshBoutique(): Observable<BoutiqueInfo> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        const info = response?.boutique || response?.data || response || DEFAULT_BOUTIQUE;
        return {
          ...info,
          logoUrl: info.logo || info.logoPath || info.logoUrl || ''
        };
      }),
      tap(info => this.persist(info)),
      catchError(() => of(this.getInfo()))
    );
  }

  getBoutique(): Observable<BoutiqueInfo> {
    return this.refreshBoutique();
  }

  updateBoutique(info: BoutiqueInfo): Observable<BoutiqueInfo> {
    const { logoUrl, logoPath, ...payload } = info as any;
    return this.http.put<any>(this.apiUrl, payload).pipe(
      map(response => {
        const updated = response?.boutique || response?.data || response || info;
        return { ...updated, logoUrl: updated.logo || updated.logoPath || logoUrl || '' };
      }),
      tap(updated => this.persist(updated))
    );
  }

  uploadLogo(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('logo', file, file.name);
    return this.http.post<any>(`${this.apiUrl}/upload-logo`, formData).pipe(
      map(response => response?.logo || response?.logoPath || response?.logoUrl || response?.url || ''),
      tap(logoUrl => this.persist({ ...this.getInfo(), logoUrl }))
    );
  }

  resetToDefaults(): Observable<BoutiqueInfo> {
    this.persist(DEFAULT_BOUTIQUE);
    return of(DEFAULT_BOUTIQUE);
  }

  private readLocalInfo(): BoutiqueInfo {
    const raw = localStorage.getItem(this.storeKey);
    if (!raw) return DEFAULT_BOUTIQUE;

    try {
      return { ...DEFAULT_BOUTIQUE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_BOUTIQUE;
    }
  }

  private persist(info: BoutiqueInfo): void {
    const value = { ...DEFAULT_BOUTIQUE, ...info };
    localStorage.setItem(this.storeKey, JSON.stringify(value));
    this.infoSubject.next(value);
  }
}
