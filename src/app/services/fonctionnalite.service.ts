import { Injectable } from '@angular/core';

const KEYS = {
  CONDITIONNEMENT: 'feat_conditionnement',
  // Réglages « petite imprimante », propres à cet appareil (le poste de caisse
  // physiquement branché à l'imprimante) — pas une fonctionnalité de toute la
  // boutique, donc pas gérée via le super admin comme IMPRESSION_TICKET (RN) :
  // demande utilisateur du 20/09/2026, un poste = un matériel = un réglage local.
  IMPRIMANTE_TICKET: 'feat_imprimante_ticket',
  IMPRESSION_AUTO: 'feat_impression_auto',
};

@Injectable({ providedIn: 'root' })
export class FonctionnaliteService {

  isConditionnementActif(): boolean {
    return localStorage.getItem(KEYS.CONDITIONNEMENT) === 'true';
  }

  setConditionnement(actif: boolean): void {
    localStorage.setItem(KEYS.CONDITIONNEMENT, String(actif));
  }

  /** true = ce poste a une petite imprimante à ticket (58/80mm) : les documents
   *  imprimés depuis cet appareil doivent utiliser le format ticket étroit
   *  plutôt que le format A4 habituel. */
  isImprimanteTicketActif(): boolean {
    return localStorage.getItem(KEYS.IMPRIMANTE_TICKET) === 'true';
  }

  setImprimanteTicket(actif: boolean): void {
    localStorage.setItem(KEYS.IMPRIMANTE_TICKET, String(actif));
  }

  /** true = imprimer automatiquement le ticket dès qu'une vente est validée,
   *  sans attendre un clic sur « Imprimer ». N'a d'effet que si
   *  isImprimanteTicketActif() est aussi vrai. */
  isImpressionAutoActif(): boolean {
    return localStorage.getItem(KEYS.IMPRESSION_AUTO) === 'true';
  }

  setImpressionAuto(actif: boolean): void {
    localStorage.setItem(KEYS.IMPRESSION_AUTO, String(actif));
  }
}
