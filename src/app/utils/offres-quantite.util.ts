/**
 * Offres par quantité (« 2 pour 75 F ») : même calcul que le serveur (CalculOffre.java).
 * Les deux doivent rester identiques, sinon le total affiché à la caisse et celui
 * enregistré ne seraient pas d'accord. Le serveur reste celui qui décide.
 */
export interface OffreEnCours {
  produitId: number;
  quantite: number;
  prix: number;
}

export interface ResultatOffre {
  remise: number;
  libelle: string | null;
}

const QUANTITE_MAX = 100000;
const AUCUNE: ResultatOffre = { remise: 0, libelle: null };

function arrondir(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function montant(v: number): string {
  return Number.isInteger(v) ? String(v) : String(arrondir(v));
}

/** Meilleur prix pour exactement n articles, en combinant les lots et le prix normal. */
export function calculerOffre(n: number, prixUnitaire: number, offres: OffreEnCours[]): ResultatOffre {
  if (!Number.isInteger(n) || n < 2 || n > QUANTITE_MAX || !(prixUnitaire > 0)) return AUCUNE;
  const utiles = offres
    .filter(o => o.quantite >= 2 && o.quantite <= n && o.prix >= 0)
    .sort((a, b) => a.quantite - b.quantite);
  if (!utiles.length) return AUCUNE;

  const cout = new Float64Array(n + 1);
  const choix = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    cout[i] = cout[i - 1] + prixUnitaire;
    choix[i] = 0;
    for (let k = 0; k < utiles.length; k++) {
      const o = utiles[k];
      if (o.quantite <= i) {
        const c = cout[i - o.quantite] + o.prix;
        if (c < cout[i] - 1e-9) {
          cout[i] = c;
          choix[i] = k + 1;
        }
      }
    }
  }
  const remise = arrondir(n * prixUnitaire - arrondir(cout[n]));
  if (remise <= 0) return AUCUNE;

  const compte = new Map<OffreEnCours, number>();
  for (let i = n; i > 0;) {
    if (choix[i] === 0) { i--; continue; }
    const o = utiles[choix[i] - 1];
    compte.set(o, (compte.get(o) || 0) + 1);
    i -= o.quantite;
  }
  const morceaux = [...compte.entries()]
    .sort((a, b) => b[0].quantite - a[0].quantite || a[0].prix - b[0].prix)
    .map(([o, nb]) => `${nb > 1 ? nb + ' × ' : ''}${o.quantite} pour ${montant(o.prix)} F`);
  return { remise, libelle: 'Offre ' + morceaux.join(' + ') };
}

/**
 * Remise d'offre d'une ligne de panier, avec les mêmes conditions que le serveur : article
 * au prix normal, sans remise, ni carton / unité de vente, ni vente au poids.
 */
export function remiseOffreLigne(
  ligne: { produitId: number; quantite: number; prixUnitaire: number; prixNormal: number;
           aRemise: boolean; parCarton: boolean; auPoids: boolean },
  offres: OffreEnCours[]
): ResultatOffre {
  if (!offres.length || ligne.aRemise || ligne.parCarton || ligne.auPoids) return AUCUNE;
  if (!(ligne.prixNormal > 0) || Math.abs((ligne.prixUnitaire || 0) - ligne.prixNormal) > 0.001) return AUCUNE;
  return calculerOffre(ligne.quantite, ligne.prixNormal, offres.filter(o => o.produitId === ligne.produitId));
}
