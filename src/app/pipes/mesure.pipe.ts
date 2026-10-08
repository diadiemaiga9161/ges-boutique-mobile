import { Pipe, PipeTransform } from '@angular/core';
import { infoMesure, prixAffiche, texteQte } from '../utils/mesure.util';

/**
 * Vente à la mesure — affichage d'une ligne (vente, facture, commande, achat...) ou d'un
 * produit : "1,25 kg" au lieu de 1250 pour un produit vendu au kg/L/m. Pour un produit à
 * l'unité, rend exactement la même valeur qu'avant.
 */
function mesureDe(l: any): { modeMesure?: string | null } {
  return { modeMesure: l?.modeMesure ?? l?.produit?.modeMesure ?? null };
}

@Pipe({ name: 'mesureQte', standalone: true })
export class MesureQtePipe implements PipeTransform {
  transform(l: any, quantite?: number): string | number {
    if (quantite === undefined && l?.quantiteTexte) return l.quantiteTexte;
    const q = quantite ?? l?.quantite;
    return infoMesure(mesureDe(l)) ? texteQte(mesureDe(l), q) : q;
  }
}

/** Prix unitaire d'une ligne tel que le client le connaît (au kg pour la mesure). */
@Pipe({ name: 'mesurePu', standalone: true })
export class MesurePuPipe implements PipeTransform {
  transform(l: any, prix?: number): number {
    const p = prix ?? l?.prixUnitaire ?? 0;
    return infoMesure(mesureDe(l)) ? prixAffiche(mesureDe(l), p) : p;
  }
}

/** Suffixe du prix unitaire : "/kg" pour la mesure, sinon rien. */
@Pipe({ name: 'mesureSuffixe', standalone: true })
export class MesureSuffixePipe implements PipeTransform {
  transform(l: any): string {
    const info = infoMesure(mesureDe(l));
    return info ? `/${info.unite}` : '';
  }
}

export const MESURE_PIPES = [MesureQtePipe, MesurePuPipe, MesureSuffixePipe] as const;
