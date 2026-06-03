import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { Network } from '@capacitor/network';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  private networkStatus$ = new BehaviorSubject<NetworkStatus>({ isOnline: true });
  private checkInterval: any;

  constructor(private http: HttpClient) {
    this.initNetworkMonitoring();
  }

  private async initNetworkMonitoring(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.networkStatus$.next({
        isOnline: status.connected,
        connectionType: status.connectionType
      });

      Network.addListener('networkStatusChange', (status) => {
        this.networkStatus$.next({
          isOnline: status.connected,
          connectionType: status.connectionType
        });
      });
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du monitoring réseau:', error);
      this.startFallbackCheck();
    }
  }

  private startFallbackCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  private checkConnectivity(): void {
    this.http.head('/', { responseType: 'text' }).pipe(
      map(() => true),
      catchError(() => of(false))
    ).subscribe(isOnline => {
      const current = this.networkStatus$.value;
      if (current.isOnline !== isOnline) {
        this.networkStatus$.next({ isOnline, connectionType: isOnline ? 'wifi' : 'none' });
      }
    });
  }

  getNetworkStatus(): Observable<NetworkStatus> {
    return this.networkStatus$.asObservable().pipe(
      distinctUntilChanged((prev, curr) => prev.isOnline === curr.isOnline)
    );
  }

  isOnline(): boolean {
    return this.networkStatus$.value.isOnline;
  }

  ngOnDestroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
