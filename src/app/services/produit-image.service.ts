import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BoutiqueService } from './boutique.service';
import { BoutiqueConfigService } from './boutique-config.service';

/**
 * Photos des produits (fonctionnalité IMAGES_PRODUITS, activée par le super admin).
 * La photo est réduite sur le téléphone avant l'envoi (moins de données mobiles), puis
 * le serveur la recompresse en deux tailles. L'affichage passe par une URL publique
 * versionnée : une nouvelle photo change l'URL, l'ancienne reste en cache sans risque.
 */
@Injectable({ providedIn: 'root' })
export class ProduitImageService {
  private static readonly COTE_ENVOI = 1024;

  private actif = false;

  constructor(
    private http: HttpClient,
    private boutiqueConfig: BoutiqueConfigService,
    boutiqueService: BoutiqueService
  ) {
    boutiqueService.fonctionnalitesAvancees$.subscribe(liste => {
      this.actif = liste.find(f => f.cle === 'IMAGES_PRODUITS')?.actif === true;
    });
  }

  /** Les photos sont-elles activées pour cette boutique ? */
  get estActif(): boolean {
    return this.actif;
  }

  /** URL de la photo, ou null si le produit n'en a pas (ou fonctionnalité désactivée). */
  url(produit: { id?: number; imageVersion?: number | null } | null | undefined, taille: 'mini' | 'grande' = 'mini'): string | null {
    if (!this.actif || !produit?.id || !produit.imageVersion) return null;
    // Dans l'appli installée, une balise <img> ne passe pas par l'intercepteur HTTP :
    // il faut l'adresse complète du serveur de la boutique.
    const base = environment.isCapacitor ? this.boutiqueConfig.getApiBaseUrl() : '';
    return `${base}${environment.apiUrl}/public/produits/${produit.id}/image?taille=${taille}&v=${produit.imageVersion}`;
  }

  envoyer(produitId: number, fichier: File): Observable<number> {
    return from(this.reduire(fichier)).pipe(
      switchMap(blob => {
        const fd = new FormData();
        fd.append('image', blob, 'photo.jpg');
        return this.http.post<{ imageVersion: number }>(`${environment.apiUrl}/produits/${produitId}/image`, fd);
      }),
      map(r => r.imageVersion)
    );
  }

  supprimer(produitId: number): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/produits/${produitId}/image`);
  }

  /** Réduit la photo (côté le plus long : 1024 px) et la convertit en JPEG. */
  private reduire(fichier: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const lien = URL.createObjectURL(fichier);
      img.onload = () => {
        URL.revokeObjectURL(lien);
        const ratio = Math.min(1, ProduitImageService.COTE_ENVOI / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(fichier); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => (b ? resolve(b) : resolve(fichier)), 'image/jpeg', 0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(lien);
        reject(new Error('Cette photo ne peut pas être lue. Essayez une photo JPG ou PNG.'));
      };
      img.src = lien;
    });
  }
}
