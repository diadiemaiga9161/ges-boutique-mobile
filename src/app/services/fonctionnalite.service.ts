import { Injectable } from '@angular/core';

const KEYS = {
  CONDITIONNEMENT: 'feat_conditionnement',
};

@Injectable({ providedIn: 'root' })
export class FonctionnaliteService {

  isConditionnementActif(): boolean {
    return localStorage.getItem(KEYS.CONDITIONNEMENT) === 'true';
  }

  setConditionnement(actif: boolean): void {
    localStorage.setItem(KEYS.CONDITIONNEMENT, String(actif));
  }
}
