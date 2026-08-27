/**
 * Convertisseur nombre entier -> lettres françaises.
 *
 * Fonction pure, sans dépendance externe ni appel réseau. Écrite indépendamment
 * pour ce projet (aucun import/partage de code avec l'app Angular web ou React
 * Native), utilisée pour l'annonce vocale du montant total d'une vente.
 *
 * Règles orthographiques respectées :
 * - "quatre-vingts" perd son "s" final s'il est suivi d'un autre nombre
 *   (81 -> "quatre-vingt-un", 80 -> "quatre-vingts").
 * - "cent" prend un "s" seulement s'il est multiplié par un nombre exact ET
 *   n'est suivi d'aucun autre nombre (200 -> "deux cents", 201 -> "deux cent un").
 * - "cent" et "quatre-vingt(s)" perdent aussi leur "s" lorsqu'ils précèdent
 *   directement "mille" (80 000 -> "quatre-vingt mille", 800 000 -> "huit cent mille"),
 *   car "mille" est un adjectif numéral invariable qui compte comme "un autre nombre".
 * - "mille" est toujours invariable (jamais de "s", jamais précédé de "un").
 * - "vingt et un", "trente et un", ... "soixante et un" et "soixante et onze"
 *   utilisent "et" — mais pas "quatre-vingt-un" ni "quatre-vingt-onze".
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const DIZAINES_SIMPLES: Record<number, string> = {
  2: 'vingt',
  3: 'trente',
  4: 'quarante',
  5: 'cinquante',
  6: 'soixante',
};

/** Convertit un nombre de 0 à 99 en lettres. */
function convertirDizaine(n: number, groupeMillier: boolean): string {
  if (n < 20) return UNITES[n];

  const dizaine = Math.floor(n / 10);
  const unite = n % 10;

  // 70-79 : "soixante-dix" à "soixante-dix-neuf" (avec "et" seulement pour 71)
  if (dizaine === 7) {
    const reste = n - 60; // 10..19
    if (reste === 11) return 'soixante et onze';
    return `soixante-${UNITES[reste]}`;
  }

  // 80-89 : "quatre-vingts" perd son "s" si suivi d'un autre nombre (unité != 0)
  // ou s'il précède directement "mille" (groupeMillier).
  if (dizaine === 8) {
    if (unite === 0) return groupeMillier ? 'quatre-vingt' : 'quatre-vingts';
    if (unite === 1) return 'quatre-vingt-un'; // jamais de "et"
    return `quatre-vingt-${UNITES[unite]}`;
  }

  // 90-99 : "quatre-vingt-dix" à "quatre-vingt-dix-neuf" (jamais de "et")
  if (dizaine === 9) {
    const reste = n - 80; // 10..19
    if (reste === 11) return 'quatre-vingt-onze';
    return `quatre-vingt-${UNITES[reste]}`;
  }

  // 20-69 : vingt, trente, quarante, cinquante, soixante
  const base = DIZAINES_SIMPLES[dizaine];
  if (unite === 0) return base;
  if (unite === 1) return `${base} et un`;
  return `${base}-${UNITES[unite]}`;
}

/**
 * Convertit un nombre de 0 à 999 en lettres.
 * @param groupeMillier true si ce groupe de 3 chiffres est le multiplicateur
 *   direct de "mille" (ex: le "80" de "80 000") — dans ce cas "cent" et
 *   "quatre-vingts" ne prennent jamais de "s" car "mille" les suit.
 */
function convertirGroupe(n: number, groupeMillier: boolean): string {
  if (n === 0) return '';

  const centaine = Math.floor(n / 100);
  const reste = n % 100;
  const parts: string[] = [];

  if (centaine > 0) {
    if (centaine === 1) {
      parts.push('cent');
    } else {
      const mot = `${UNITES[centaine]} cent`;
      const prendS = reste === 0 && !groupeMillier;
      parts.push(prendS ? `${mot}s` : mot);
    }
  }

  if (reste > 0) {
    parts.push(convertirDizaine(reste, groupeMillier));
  }

  return parts.join(' ');
}

/**
 * Convertit un entier (positif, négatif ou nul) en toutes lettres françaises.
 * Supporte les montants jusqu'à 999 999 999 999 (999 milliards), largement
 * suffisant pour un montant de vente en francs CFA.
 */
export function nombreEnLettres(valeur: number): string {
  const entier = Math.trunc(Math.abs(valeur || 0));

  if (entier === 0) return 'zéro';

  const milliards = Math.floor(entier / 1_000_000_000);
  const millions = Math.floor((entier % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((entier % 1_000_000) / 1_000);
  const unites = entier % 1000;

  const parts: string[] = [];

  if (milliards > 0) {
    const mot = milliards === 1 ? 'milliard' : 'milliards';
    parts.push(`${convertirGroupe(milliards, false)} ${mot}`);
  }

  if (millions > 0) {
    const mot = millions === 1 ? 'million' : 'millions';
    parts.push(`${convertirGroupe(millions, false)} ${mot}`);
  }

  if (milliers > 0) {
    if (milliers === 1) {
      parts.push('mille');
    } else {
      parts.push(`${convertirGroupe(milliers, true)} mille`);
    }
  }

  if (unites > 0) {
    parts.push(convertirGroupe(unites, false));
  }

  const resultat = parts.join(' ').replace(/\s+/g, ' ').trim();
  return valeur < 0 ? `moins ${resultat}` : resultat;
}

/**
 * Construit la phrase d'annonce vocale du montant total d'une vente,
 * ex: "Total : quinze mille cinq cents francs".
 */
export function construireAnnonceMontant(montant: number): string {
  const entier = Math.trunc(Math.abs(montant || 0));
  const unite = entier <= 1 ? 'franc' : 'francs';
  return `Total : ${nombreEnLettres(montant)} ${unite}`;
}
