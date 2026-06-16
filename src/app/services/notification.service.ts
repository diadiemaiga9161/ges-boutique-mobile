import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const URL_BASE = `${environment.apiUrl}/notifications`;

export interface Notification {
  id: number;
  type: string;
  titre: string;
  message: string;
  lien?: string;
  lu: boolean;
  dateCreation: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private _count = new BehaviorSubject<number>(0);
  count$ = this._count.asObservable();

  private _nonLues = new BehaviorSubject<Notification[]>([]);
  nonLues$ = this._nonLues.asObservable();

  constructor(private http: HttpClient) {
    this.charger();
    interval(30000).subscribe(() => this.charger());
  }

  charger(): void {
    this.http.get<Notification[]>(`${URL_BASE}/non-lues`).subscribe({
      next: (list) => {
        this._nonLues.next(list);
        this._count.next(list.length);
      },
      error: () => {}
    });
  }

  getTout(): Observable<Notification[]> {
    return this.http.get<Notification[]>(URL_BASE);
  }

  marquerLue(id: number): Observable<Notification> {
    return this.http.put<Notification>(`${URL_BASE}/lu/${id}`, {}).pipe(
      tap(() => this.charger())
    );
  }

  marquerToutesLues(): Observable<void> {
    return this.http.put<void>(`${URL_BASE}/tout-lire`, {}).pipe(
      tap(() => this.charger())
    );
  }
}
