import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AppUser {
  id: number;
  username: string;
  nomComplet: string;
  email: string;
  telephone: string;
  role: 'ADMIN' | 'VENDEUR';
  actif: boolean;
  dateCreation?: string;
}

export interface UserCreate {
  username: string;
  password: string;
  nomComplet: string;
  email: string;
  telephone: string;
  role: 'ADMIN' | 'VENDEUR';
}

export interface UserUpdate {
  nomComplet?: string;
  email?: string;
  telephone?: string;
  password?: string;
  role?: 'ADMIN' | 'VENDEUR';
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/utilisateurs`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.apiUrl);
  }

  getUserById(id: number): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.apiUrl}/${id}`);
  }

  createUser(userData: UserCreate): Observable<AppUser> {
    return this.http.post<AppUser>(this.apiUrl, userData);
  }

  updateUser(id: number, userData: UserUpdate): Observable<AppUser> {
    return this.http.put<AppUser>(`${this.apiUrl}/${id}`, userData);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUsersByRole(role: 'ADMIN' | 'VENDEUR'): Observable<AppUser[]> {
    return this.getAllUsers().pipe(map(users => users.filter(user => user.role === role)));
  }

  searchUsers(searchTerm: string): Observable<AppUser[]> {
    const term = searchTerm.toLowerCase();
    return this.getAllUsers().pipe(
      map(users => users.filter(user =>
        user.nomComplet?.toLowerCase().includes(term) ||
        user.username?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term)
      ))
    );
  }
}
