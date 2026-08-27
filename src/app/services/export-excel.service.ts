import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';

/**
 * Génère des classeurs Excel (.xlsx) avec SheetJS et gère leur écriture/partage :
 *  - Sur mobile (Android/iOS via Capacitor) : écriture dans le cache de l'app puis
 *    ouverture de la feuille de partage native (@capacitor/share).
 *  - Sur navigateur web (mode dev / PWA) : fallback classique de téléchargement par Blob.
 */
@Injectable({ providedIn: 'root' })
export class ExportExcelService {

  /**
   * @param nomFichier nom du fichier SANS extension (ex: "Clients_2026-08-26")
   * @param nomFeuille  nom de l'onglet Excel (tronqué à 31 caractères, limite Excel)
   * @param colonnes    en-têtes de colonnes
   * @param lignes      lignes de données (déjà formatées en texte pour l'affichage)
   */
  async exporterExcel(nomFichier: string, nomFeuille: string, colonnes: string[], lignes: (string | number)[][]): Promise<void> {
    const classeur = XLSX.utils.book_new();
    const donnees = [colonnes, ...lignes];
    const feuille = XLSX.utils.aoa_to_sheet(donnees);
    XLSX.utils.book_append_sheet(classeur, feuille, (nomFeuille || 'Export').substring(0, 31));

    const base64 = XLSX.write(classeur, { type: 'base64', bookType: 'xlsx' }) as string;
    const nomComplet = `${nomFichier}.xlsx`;

    if (Capacitor.isNativePlatform()) {
      const resultat = await Filesystem.writeFile({
        path: nomComplet,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: nomFichier,
        text: `Export ${nomFeuille}`,
        url: resultat.uri,
        dialogTitle: 'Partager le fichier Excel',
      });
    } else {
      this.telechargerBlobWeb(base64, nomComplet);
    }
  }

  /** Fallback navigateur web : conversion base64 -> Blob puis téléchargement classique. */
  private telechargerBlobWeb(base64: string, nomFichier: string): void {
    const octetsTexte = atob(base64);
    const tableauOctets = new Uint8Array(octetsTexte.length);
    for (let i = 0; i < octetsTexte.length; i++) {
      tableauOctets[i] = octetsTexte.charCodeAt(i);
    }
    const blob = new Blob([tableauOctets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
