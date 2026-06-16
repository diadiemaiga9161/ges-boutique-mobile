import { Injectable } from '@angular/core';
import { VenteMap } from './vente.service';

@Injectable({ providedIn: 'root' })
export class VenteEditService {
  venteAModifier: VenteMap | null = null;

  setVente(vente: VenteMap): void {
    this.venteAModifier = vente;
  }

  clear(): void {
    this.venteAModifier = null;
  }
}
