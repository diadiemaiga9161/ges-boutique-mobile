import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { environment } from '../../environments/environment';

export interface BackupInfo {
  nomFichier: string;
  dateCreation: string;
  tailleOctets: number;
}

export interface BackupListeResponse {
  success: boolean;
  sauvegardes: BackupInfo[];
  nombre: number;
}

export interface BackupDeclencherResponse {
  success: boolean;
  message: string;
  nomFichier?: string;
  tailleOctets?: number;
  dateCreation?: string;
}

/**
 * Sauvegarde automatique programmée (ADMIN uniquement) — dump MySQL déclenché
 * manuellement ou via cron côté serveur. Le déclenchement peut prendre plusieurs
 * secondes (mysqldump synchrone côté backend) : prévoir un état de chargement
 * bloquant côté appelant.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly apiUrl = `${environment.apiUrl}/backup`;

  constructor(private http: HttpClient) {}

  /** Liste des sauvegardes disponibles, triée du plus récent au plus ancien (ordre backend conservé). */
  getListe(): Observable<BackupInfo[]> {
    return this.http.get<BackupListeResponse>(`${this.apiUrl}/liste`).pipe(
      map(response => Array.isArray(response?.sauvegardes) ? response.sauvegardes : []),
      catchError(error => this.handleError(error, 'récupérer la liste des sauvegardes'))
    );
  }

  /** Déclenche une sauvegarde immédiate (mysqldump synchrone côté serveur — peut être long). */
  declencher(): Observable<BackupDeclencherResponse> {
    return this.http.post<BackupDeclencherResponse>(`${this.apiUrl}/declencher`, {}).pipe(
      catchError(error => this.handleError(error, 'déclencher la sauvegarde'))
    );
  }

  /**
   * Restaure la base de données à partir d'un fichier de sauvegarde (SUPER ADMIN uniquement).
   * Opération destructive : écrase les données actuelles. Le backend crée automatiquement
   * une sauvegarde de sécurité de l'état précédent avant de restaurer (dump + restore mysql
   * synchrones côté serveur — peut être long, prévoir un état de chargement bloquant).
   */
  restaurer(nomFichier: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/restaurer/${encodeURIComponent(nomFichier)}`, {}).pipe(
      catchError(error => this.handleError(error, 'restaurer la sauvegarde'))
    );
  }

  /** Télécharge le fichier binaire (.sql.gz) via HttpClient (JWT auto par AuthInterceptor). */
  telecharger(nomFichier: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/telecharger/${encodeURIComponent(nomFichier)}`, { responseType: 'blob' }).pipe(
      catchError(error => this.handleError(error, 'télécharger la sauvegarde'))
    );
  }

  /**
   * Télécharge puis propose l'enregistrement/partage du fichier :
   *  - Sur mobile (Capacitor) : écriture dans le cache de l'app (base64) puis
   *    ouverture de la feuille de partage native (@capacitor/share).
   *  - Sur navigateur web (mode dev / PWA) : téléchargement classique par Blob.
   * Même mécanisme que ExportExcelService.exporterExcel() / FactureService.partagerFacture().
   */
  async telechargerEtPartager(nomFichier: string): Promise<void> {
    const blob = await this.telecharger(nomFichier).toPromise();
    if (!blob) throw new Error('Fichier introuvable');

    if (Capacitor.isNativePlatform()) {
      const base64 = await this.blobToBase64(blob);
      const resultat = await Filesystem.writeFile({
        path: nomFichier,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: nomFichier,
        text: `Sauvegarde de la base de données — ${nomFichier}`,
        url: resultat.uri,
        dialogTitle: 'Partager la sauvegarde',
      });
    } else {
      this.telechargerBlobWeb(blob, nomFichier);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private telechargerBlobWeb(blob: Blob, nomFichier: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /** Formatte une taille en octets en Ko/Mo lisible. */
  formatTaille(octets: number): string {
    if (octets === null || octets === undefined || isNaN(octets)) return '';
    if (octets < 1024) return `${octets} o`;
    const ko = octets / 1024;
    if (ko < 1024) return `${ko.toFixed(ko < 10 ? 1 : 0)} Ko`;
    const mo = ko / 1024;
    return `${mo.toFixed(mo < 10 ? 1 : 0)} Mo`;
  }

  /** Formatte une date LocalDateTime backend (yyyy-MM-ddTHH:mm:ss) en date lisible. */
  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    else if (typeof error.error === 'string') message = error.error;
    return throwError(() => Object.assign(new Error(message), { status: error.status }));
  }
}
