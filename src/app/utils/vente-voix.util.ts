/**
 * Vente à la voix : transforme une phrase dite par le vendeur (« deux coca, un kilo de
 * sucre ») en lignes de panier proposées. Rien n'est ajouté ici : le vendeur confirme
 * chaque ligne dans le panier. Fonctions pures, sans Angular, pour pouvoir les tester seules.
 */

export interface ProduitVoix {
  id?: number;
  nom: string;
  surnoms?: string | null;
}

/** Morceau de phrase pour un produit : « deux cartons de lait » → 2, carton, « lait ». */
export interface MorceauVoix {
  quantite: number | null;
  /** Unité de mesure dite : kg, g, l, m (produits vendus au poids, au litre, au mètre). */
  mesure: 'kg' | 'g' | 'l' | 'm' | null;
  /** Conditionnement dit : carton, paquet, sachet… (à rapprocher des unités du produit). */
  conditionnement: string | null;
  texte: string;
}

export interface CandidatVoix<P extends ProduitVoix> {
  produit: P;
  score: number;
}

export interface LigneVoix<P extends ProduitVoix> {
  morceau: MorceauVoix;
  candidats: CandidatVoix<P>[];
  /** Produit retenu d'office quand il n'y a pas de doute ; sinon le vendeur choisit. */
  choisi: P | null;
}

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100,
};

const MESURES: Record<string, 'kg' | 'g' | 'l' | 'm'> = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  gramme: 'g', grammes: 'g', g: 'g',
  litre: 'l', litres: 'l', l: 'l',
  metre: 'm', metres: 'm', m: 'm',
};

const CONDITIONNEMENTS = new Set([
  'carton', 'cartons', 'paquet', 'paquets', 'sachet', 'sachets', 'cartouche', 'cartouches',
  'boite', 'boites', 'sac', 'sacs', 'bidon', 'bidons', 'douzaine', 'douzaines', 'pack', 'packs',
  'caisse', 'caisses', 'bouteille', 'bouteilles', 'piece', 'pieces', 'botte', 'bottes', 'tas',
]);

/** Mots sans valeur pour reconnaître un produit. */
const MOTS_VIDES = new Set([
  'de', 'd', 'du', 'des', 'la', 'le', 'les', 'l', 'et', 'aussi', 'avec', 'en', 'plus', 'puis',
  'svp', 'stp', 'merci', 'donne', 'donnez', 'moi', 'il', 'faut', 'je', 'veux', 'voudrais', 'mettre',
  'mets', 'ajoute', 'ajouter', 'encore', 'alors', 'euh', 'bon', 'ok', 'oui', 'a', 'au', 'aux', 'pour',
]);

/** Minuscules, sans accents ni ponctuation (la virgule décimale « 1,5 » est gardée). */
export function normaliserVoix(texte: string): string {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[,.](\d)/g, '$1.$2')
    .replace(/[''`’\-_/]/g, ' ')
    .replace(/[^a-z0-9., ]/g, ' ')
    .replace(/\s*,\s*/g, ' , ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nombre(mot: string): number | null {
  if (/^\d+(\.\d+)?$/.test(mot)) return parseFloat(mot);
  return NOMBRES[mot] ?? null;
}

/** Lit un nombre qui peut tenir sur plusieurs mots (« vingt cinq », « quatre vingt »). */
function lireNombre(mots: string[], i: number): { valeur: number; fin: number } | null {
  let v = nombre(mots[i]);
  if (v == null) return null;
  let j = i + 1;
  // « vingt cinq », « cent vingt », « quatre vingt dix »
  while (j < mots.length) {
    const n = nombre(mots[j]);
    if (n == null || /^\d/.test(mots[j])) break;
    if (n === 100 || (n === 20 && v < 20 && v > 1)) v = v * n;
    else if (n < v || v % 10 === 0) v = v + n;
    else break;
    j++;
  }
  // « et demi » : 1 et demi = 1,5
  if (mots[j] === 'etdemi') { v += 0.5; j++; }
  return { valeur: v, fin: j };
}

/**
 * Découpe la phrase en morceaux, un par produit. La reconnaissance vocale met rarement des
 * virgules : un nouveau nombre après des mots de produit commence un nouveau morceau,
 * sauf s'il fait partie du nom (« coca 1.5 litre », « riz 25 kg » quand il suit un nom).
 */
export function decouperVoix(texte: string): MorceauVoix[] {
  const morceaux: MorceauVoix[] = [];
  // « et » sépare deux produits, sauf dans « un et demi » et « vingt et un ».
  const brut = normaliserVoix(texte)
    .replace(/ et demi\b/g, ' etdemi')
    .replace(/\b(vingt|trente|quarante|cinquante|soixante) et (un|une)\b/g, '$1 un')
    .replace(/\s(et|puis|plus)\s/g, ' , ');
  for (const partie of brut.split(/\s*,\s*|\s+\.\s+/)) {
    const mots = partie.split(' ').filter(Boolean);
    let courant: MorceauVoix = { quantite: null, mesure: null, conditionnement: null, texte: '' };
    const noms: string[] = [];
    const pousser = () => {
      courant.texte = noms.join(' ').trim();
      if (courant.texte) morceaux.push(courant);
      noms.length = 0;
      courant = { quantite: null, mesure: null, conditionnement: null, texte: '' };
    };
    let i = 0;
    while (i < mots.length) {
      const m = mots[i];
      if (m === 'demi' || (m === 'un' && mots[i + 1] === 'demi')) {
        // « demi kilo », « un demi litre »
        if (noms.length) pousser();
        courant.quantite = 0.5;
        i += m === 'demi' ? 1 : 2;
        continue;
      }
      const n = lireNombre(mots, i);
      if (n) {
        const suivant = mots[n.fin];
        const estMesure = suivant != null && MESURES[suivant] != null;
        // Nombre en chiffres collé à une unité juste après un nom : il fait partie du nom
        // (« coca 1.5 l ») ; « un kilo » dit en lettres commence au contraire un autre produit.
        if (noms.length && estMesure && courant.quantite != null && /^\d/.test(mots[i])) {
          noms.push(mots.slice(i, n.fin + 1).join(' '));
          i = n.fin + 1;
          continue;
        }
        // Nombre dit après le nom, sans quantité avant (« sucre deux kilos ») : c'est la quantité.
        if (noms.length && courant.quantite == null) {
          courant.quantite = n.valeur;
          i = n.fin;
          if (estMesure) { courant.mesure = MESURES[suivant]; i++; }
          pousser();
          continue;
        }
        if (noms.length) pousser();
        courant.quantite = n.valeur;
        i = n.fin;
        if (estMesure) { courant.mesure = MESURES[suivant]; i++; }
        else if (suivant != null && CONDITIONNEMENTS.has(suivant)) { courant.conditionnement = suivant.replace(/s$/, ''); i++; }
        continue;
      }
      if (!noms.length && courant.quantite != null && courant.mesure == null && MESURES[m] && m.length > 1) {
        courant.mesure = MESURES[m]; i++; continue;
      }
      if (!noms.length && CONDITIONNEMENTS.has(m)) { courant.conditionnement = m.replace(/s$/, ''); i++; continue; }
      if (!MOTS_VIDES.has(m)) noms.push(m);
      i++;
    }
    pousser();
  }
  return morceaux;
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prec = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1));
      prec = tmp;
    }
  }
  return d[b.length];
}

function motsUtiles(texte: string): string[] {
  return normaliserVoix(texte).split(' ').filter(m => m && !MOTS_VIDES.has(m));
}

/** « yaourts » → « yaourt », « gateaux » → « gateau » (mots de plus de 3 lettres). */
function singulier(mot: string): string {
  return mot.length > 3 && /[sx]$/.test(mot) && !/^\d/.test(mot) ? mot.slice(0, -1) : mot;
}

/** Ressemblance d'un mot entendu avec un mot du produit (1 = identique). */
function ressemblance(entendu: string, mot: string): number {
  if (entendu === mot || singulier(entendu) === singulier(mot)) return 1;
  if (entendu.length >= 3 && mot.length >= 3 && (mot.startsWith(entendu) || entendu.startsWith(mot))) return 0.8;
  if (/^\d/.test(entendu) || /^\d/.test(mot)) return 0;
  const d = distance(entendu, mot);
  if (d === 1 && Math.min(entendu.length, mot.length) >= 4) return 0.7;
  if (d === 2 && Math.min(entendu.length, mot.length) >= 7) return 0.5;
  return 0;
}

/** Note de 0 à 1 entre le texte entendu et un nom (nom du produit ou un de ses surnoms). */
export function noteNom(entendu: string, nom: string): number {
  const e = motsUtiles(entendu);
  const n = motsUtiles(nom);
  if (!e.length || !n.length) return 0;
  if (e.join(' ') === n.join(' ')) return 1;
  let trouve = 0;
  const utilises = new Set<number>();
  for (const me of e) {
    let meilleur = 0, idx = -1;
    n.forEach((mn, k) => {
      if (utilises.has(k)) return;
      const r = ressemblance(me, mn);
      if (r > meilleur) { meilleur = r; idx = k; }
    });
    if (idx >= 0) utilises.add(idx);
    trouve += meilleur;
  }
  // Surtout : les mots entendus doivent se retrouver dans le nom ; un peu : le nom doit être couvert.
  return 0.75 * (trouve / e.length) + 0.25 * Math.min(1, trouve / n.length);
}

export function noteProduit(entendu: string, p: ProduitVoix): number {
  let meilleure = noteNom(entendu, p.nom);
  for (const s of (p.surnoms || '').split(',')) {
    if (s.trim()) meilleure = Math.max(meilleure, noteNom(entendu, s) * 1.02);
  }
  return Math.min(1, meilleure);
}

const SEUIL = 0.45;

/** Produits les plus proches du texte entendu (3 au maximum). */
export function chercherProduits<P extends ProduitVoix>(entendu: string, produits: P[]): CandidatVoix<P>[] {
  return produits
    .map(produit => ({ produit, score: noteProduit(entendu, produit) }))
    .filter(c => c.score >= SEUIL)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Phrase complète → lignes proposées, avec le produit retenu quand il n'y a pas de doute. */
export function comprendreVoix<P extends ProduitVoix>(texte: string, produits: P[]): LigneVoix<P>[] {
  return decouperVoix(texte).map(morceau => {
    const candidats = chercherProduits(morceau.texte, produits);
    const [premier, second] = candidats;
    const sur = premier && ((premier.score >= 0.75 && (!second || premier.score - second.score >= 0.12))
      || (!second && premier.score >= 0.65));
    return { morceau, candidats, choisi: sur ? premier.produit : null };
  });
}

/** Parmi les phrases proposées par la reconnaissance, celle qui correspond le mieux aux produits. */
export function meilleureVersion<P extends ProduitVoix>(versions: string[], produits: P[]): { texte: string; lignes: LigneVoix<P>[] } {
  let meilleure = { texte: versions[0] || '', lignes: comprendreVoix(versions[0] || '', produits) };
  let note = -1;
  for (const v of versions) {
    const lignes = comprendreVoix(v, produits);
    const n = lignes.reduce((s, l) => s + (l.choisi ? 1 : l.candidats.length ? 0.5 : 0), 0) - 0.01 * lignes.length;
    if (n > note) { note = n; meilleure = { texte: v, lignes }; }
  }
  return meilleure;
}
