/**
 * Vente à la mesure (kg, L, m) — même principe que ModeMesure côté serveur : un produit
 * vendu à la mesure garde en base des nombres entiers en petite unité (g, ml, cm) et des
 * prix PAR petite unité (600 F/kg -> 0,6 F/g). Ces fonctions convertissent uniquement pour
 * l'affichage et la saisie ; les calculs (prix x quantité) restent ceux d'avant.
 */
export type ModeMesure = 'KG' | 'L' | 'M';

export interface InfoMesure {
  facteur: number;
  unite: string;
  petiteUnite: string;
  libelle: string;
  /** Boutons rapides proposés à la vente, en unité affichée. */
  rapides: number[];
}

export const MESURES: Record<ModeMesure, InfoMesure> = {
  KG: { facteur: 1000, unite: 'kg', petiteUnite: 'g', libelle: 'Au kilo (kg)', rapides: [0.25, 0.5, 1, 2, 5] },
  L: { facteur: 1000, unite: 'L', petiteUnite: 'ml', libelle: 'Au litre (L)', rapides: [0.25, 0.5, 1, 1.5, 5] },
  M: { facteur: 100, unite: 'm', petiteUnite: 'cm', libelle: 'Au mètre (m)', rapides: [0.5, 1, 2, 5, 10] }
};

export function infoMesure(p: { modeMesure?: string | null } | null | undefined): InfoMesure | null {
  const m = p?.modeMesure as ModeMesure | undefined;
  return m && MESURES[m] ? MESURES[m] : null;
}

/** Quantité stockée (g) -> quantité affichée (kg). Inchangée pour un produit à l'unité. */
export function qteAffichee(p: { modeMesure?: string | null } | null | undefined, stockee: number | null | undefined): number {
  const info = infoMesure(p);
  const v = Number(stockee) || 0;
  return info ? v / info.facteur : v;
}

/** Quantité saisie (kg) -> quantité stockée (g), toujours un entier. */
export function qteStockee(p: { modeMesure?: string | null } | null | undefined, affichee: number | null | undefined): number {
  const info = infoMesure(p);
  const v = Number(affichee) || 0;
  return info ? Math.round(v * info.facteur) : Math.round(v);
}

/** Prix stocké (par g) -> prix affiché (par kg). */
export function prixAffiche(p: { modeMesure?: string | null } | null | undefined, stocke: number | null | undefined): number {
  const info = infoMesure(p);
  const v = Number(stocke) || 0;
  return info ? v * info.facteur : v;
}

/** Prix saisi (par kg) -> prix stocké (par g). */
export function prixStocke(p: { modeMesure?: string | null } | null | undefined, affiche: number | null | undefined): number {
  const info = infoMesure(p);
  const v = Number(affiche) || 0;
  return info ? v / info.facteur : v;
}

/** "1,25 kg" (ou "3" pour un produit à l'unité, ou "3 Pièce" si une unité est donnée). */
export function texteQte(p: { modeMesure?: string | null } | null | undefined, stockee: number | null | undefined, uniteSiUnite?: string): string {
  const info = infoMesure(p);
  if (!info) {
    const n = Number(stockee) || 0;
    return uniteSiUnite ? `${n} ${uniteSiUnite}` : `${n}`;
  }
  const v = (Number(stockee) || 0) / info.facteur;
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${info.unite}`;
}

/** Lit un nombre tapé à la française ("1,25") ou à l'anglaise ("1.25"). */
export function lireNombre(texte: string | number | null | undefined): number {
  if (typeof texte === 'number') return texte;
  const v = parseFloat(String(texte ?? '').replace(/\s/g, '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
}

/**
 * Devine la contenance d'une unité à partir du nom du produit, dans l'unité de mesure
 * choisie : "Riz royal 50kg" -> 50 (KG), "Sucre 500 g" -> 0,5 (KG), "Huile 5L" -> 5 (L).
 * Simple proposition pré-remplie : le gérant la corrige si besoin. 1 si rien trouvé.
 */
export function contenanceDepuisNom(nom: string | null | undefined, mode: string | null | undefined): number {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|grammes?|l|litres?|cl|ml|m|mètres?|metres?|cm)\b/i.exec(nom || '');
  if (!m) return 1;
  const v = parseFloat(m[1].replace(',', '.'));
  const u = m[2].toLowerCase();
  const enKgOuL: Record<string, number> = { kg: 1, kilo: 1, kilos: 1, g: 0.001, gramme: 0.001, grammes: 0.001, l: 1, litre: 1, litres: 1, cl: 0.01, ml: 0.001 };
  const enM: Record<string, number> = { m: 1, 'mètre': 1, 'mètres': 1, metre: 1, metres: 1, cm: 0.01 };
  const poids = ['kg', 'kilo', 'kilos', 'g', 'gramme', 'grammes'];
  const volume = ['l', 'litre', 'litres', 'cl', 'ml'];
  if (mode === 'KG' && poids.includes(u)) return v * enKgOuL[u];
  if (mode === 'L' && volume.includes(u)) return v * enKgOuL[u];
  if (mode === 'M' && enM[u] != null) return v * enM[u];
  return 1;
}

/** Mode de mesure d'une ligne (vente, facture, commande, mouvement de stock) ou d'un produit. */
function modeDe(l: any): { modeMesure?: string | null } {
  return { modeMesure: l?.modeMesure ?? l?.produit?.modeMesure ?? null };
}

/** Quantité lisible dans un document : "1,8 kg" pour la mesure, sinon le nombre tel quel. */
export function qteDoc(l: any, quantite?: number | null): string {
  if (quantite == null && l?.quantiteTexte) return l.quantiteTexte;
  const q = quantite ?? l?.quantite;
  return infoMesure(modeDe(l)) ? texteQte(modeDe(l), q) : String(q ?? '');
}

/** Prix unitaire lisible dans un document : fmt(1450) + "/kg" pour la mesure, sinon fmt(prix). */
export function puDoc(l: any, fmt: (v: number) => string, prix?: number | null): string {
  const m = modeDe(l);
  const info = infoMesure(m);
  const p = Number(prix ?? l?.prixUnitaire ?? 0);
  return info ? `${fmt(prixAffiche(m, p))}/${info.unite}` : fmt(p);
}
