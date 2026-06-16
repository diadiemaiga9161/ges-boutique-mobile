import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LocalStoreService } from './local-store.service';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  id: number;
  username: string;
  role: string;
  nomComplet: string;
  email: string;
  telephone: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  nomComplet: string;
  email: string;
  telephone: string;
  actif?: boolean;
  photo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'boutique_auth_token';
  private readonly legacyTokenKey = 'auth_token';
  private readonly userKey = 'boutique_user_data';
  private readonly legacyUserKey = 'user_data';

  private authenticatedSubject = new BehaviorSubject<boolean>(this.isAuthenticated());
  authenticated$ = this.authenticatedSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private store: LocalStoreService
  ) {}

  signin(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => this.persistSession(response)),
      catchError(error => {
        let message = 'Erreur de connexion';
        if (error.status === 0) message = 'Impossible de se connecter au serveur';
        if (error.status === 401) message = 'Nom utilisateur ou mot de passe incorrect';
        if (error.error?.message) message = error.error.message;
        return throwError(() => new Error(message));
      })
    );
  }

  register(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, payload);
  }

  signout(): void {
    this.store.removeItem(this.tokenKey);
    this.store.removeItem(this.legacyTokenKey);
    this.store.removeItem(this.userKey);
    this.store.removeItem(this.legacyUserKey);
    this.authenticatedSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigateByUrl('/login');
  }

  getToken(): string | null {
    return this.store.getItem<string>(this.tokenKey) || this.store.getItem<string>(this.legacyTokenKey);
  }

  getUser(): User | null {
    return this.store.getItem<User>(this.userKey) || this.store.getItem<User>(this.legacyUserKey);
  }

  getUserId(): number {
    return this.getUser()?.id || 0;
  }

  getDisplayName(): string {
    const user = this.getUser();
    return user?.nomComplet || user?.username || 'Utilisateur';
  }

  getFormattedRole(): string {
    return (this.getUser()?.role || '').replace('ROLE_', '');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const decoded = this.decodeJwtToken(token);
    if (decoded?.exp) {
      return decoded.exp * 1000 > Date.now();
    }

    return true;
  }

  hasRole(role: string): boolean {
    const userRole = (this.getUser()?.role || '').toUpperCase().replace('ROLE_', '');
    const expected = role.toUpperCase().replace('ROLE_', '');
    return userRole === expected;
  }

  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  isVendeur(): boolean {
    return this.hasRole('VENDEUR');
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (!token) throw new Error('Token non disponible. Veuillez vous reconnecter.');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  motDePasseOublie(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/mot-de-passe-oublie`, { email });
  }

  verifierTokenReset(token: string): Observable<{ valide: boolean }> {
    return this.http.get<{ valide: boolean }>(`${this.apiUrl}/verifier-token-reset`, { params: { token } });
  }

  reinitialiserPassword(token: string, nouveauPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reinitialiser-password`, { token, nouveauPassword });
  }

  getCurrentProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => this.persistUser(user))
    );
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profil`, userData).pipe(
      tap(user => this.persistUser(user))
    );
  }

  updatePhoto(photoBase64: string): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/utilisateurs/me/photo`, { photo: photoBase64 }).pipe(
      tap(() => {
        const user = this.getUser();
        if (user) {
          user.photo = photoBase64;
          this.persistUser(user);
        }
      })
    );
  }

  getPhoto(): string | null {
    return this.getUser()?.photo || null;
  }

  private persistSession(response: LoginResponse): void {
    this.store.setItem(this.tokenKey, response.token);
    this.store.setItem(this.legacyTokenKey, response.token);

    const user: User = {
      id: response.id,
      username: response.username,
      role: response.role,
      nomComplet: response.nomComplet,
      email: response.email,
      telephone: response.telephone,
      photo: (response as any).photo || undefined
    };

    this.persistUser(user);
    this.authenticatedSubject.next(true);
  }

  private persistUser(user: User): void {
    this.store.setItem(this.userKey, user);
    this.store.setItem(this.legacyUserKey, user);
    this.currentUserSubject.next(user);
  }

  private decodeJwtToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }
}
