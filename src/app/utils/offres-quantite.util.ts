/**
 * Offres par quantité (« 3 pour 70 F », pour exactement 3 articles) : même calcul que le
 * serveur (CalculOffre.java).
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

/**
 * Offre pour exactement n articles : « 3 pour 70 F » ne joue que si le client en prend 3.
 * Pour 4 ou 6, prix normal, sauf si le gérant a créé une offre pour 4 ou pour 6.
 */
export function calculerOffre(n: number, prixUnitaire: number, offres: OffreEnCours[]): ResultatOffre {
  if (!Number.isInteger(n) || n < 2 || n > QUANTITE_MAX || !(prixUnitaire > 0)) return AUCUNE;
  const exactes = offres.filter(o => o.quantite === n && o.prix > 0).sort((a, b) => a.prix - b.prix);
  if (!exactes.length) return AUCUNE;
  const o = exactes[0];
  const remise = arrondir(n * prixUnitaire - o.prix);
  if (remise <= 0) return AUCUNE;
  return { remise, libelle: `Offre ${o.quantite} pour ${montant(o.prix)} F` };
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
