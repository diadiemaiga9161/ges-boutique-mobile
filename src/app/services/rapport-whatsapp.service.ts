import { Injectable } from '@angular/core';
import { BoutiqueService } from './boutique.service';
import { RapportJournalier, RapportHebdomadaire, RapportMensuel } from './rapport.service';

@Injectable({ providedIn: 'root' })
export class RapportWhatsappService {

  constructor(private boutique: BoutiqueService) {}

  envoyerRapportJour(rapport: RapportJournalier): void {
    const info = this.boutique.getInfo();
    const devise = info.devise || 'FCFA';
    const lignes = [
      `📊 *Rapport journalier — ${rapport.date}*`,
      `🏪 ${info.nom}`,
      ``,
      `💰 CA du jour : ${this.money(rapport.chiffreAffaireTotal, devise)}`,
      `📈 Bénéfice : ${this.money(rapport.beneficeTotal, devise)}`,
      `🛒 Ventes : ${rapport.nombreVentes}`,
    ];
    if (rapport.montantRemisesTotal > 0) {
      lignes.push(`🏷️ Remises : ${this.money(rapport.montantRemisesTotal, devise)}`);
    }
    if (rapport.produitsEnStockFaible > 0) {
      lignes.push(`⚠️ Stock bas : ${rapport.produitsEnStockFaible} produit(s)`);
    }
    if (rapport.topProduits?.length) {
      lignes.push(``, `🏆 *Top produits :*`);
      rapport.topProduits.slice(0, 3).forEach((p, i) => {
        lignes.push(`  ${i + 1}. ${p.nom} — ${p.quantite} vendu(s)`);
      });
    }
    this.envoyer(lignes.join('\n'));
  }

  envoyerRapportSemaine(rapport: RapportHebdomadaire): void {
    const info = this.boutique.getInfo();
    const devise = info.devise || 'FCFA';
    const lignes = [
      `📊 *Rapport hebdomadaire*`,
      `🏪 ${info.nom}`,
      `📅 ${rapport.debutSemaine} → ${rapport.finSemaine}`,
      ``,
      `💰 CA semaine : ${this.money(rapport.chiffreAffaireTotal, devise)}`,
      `🛒 Ventes : ${rapport.nombreVentes}`,
    ];
    if (rapport.montantRemisesTotal > 0) {
      lignes.push(`🏷️ Remises : ${this.money(rapport.montantRemisesTotal, devise)}`);
    }
    if (rapport.topProduits?.length) {
      lignes.push(``, `🏆 *Top produits :*`);
      rapport.topProduits.slice(0, 3).forEach((p, i) => {
        lignes.push(`  ${i + 1}. ${p.nom} — ${p.quantite} vendu(s)`);
      });
    }
    this.envoyer(lignes.join('\n'));
  }

  envoyerRapportMois(rapport: RapportMensuel): void {
    const info = this.boutique.getInfo();
    const devise = info.devise || 'FCFA';
    const lignes = [
      `📊 *Rapport mensuel — ${rapport.mois} ${rapport.annee}*`,
      `🏪 ${info.nom}`,
      ``,
      `💰 CA du mois : ${this.money(rapport.chiffreAffaireTotal, devise)}`,
      `🛒 Ventes : ${rapport.nombreVentes}`,
    ];
    if (rapport.montantRemisesTotal > 0) {
      lignes.push(`🏷️ Remises : ${this.money(rapport.montantRemisesTotal, devise)}`);
    }
    if (rapport.topProduits?.length) {
      lignes.push(``, `🏆 *Top produits :*`);
      rapport.topProduits.slice(0, 3).forEach((p, i) => {
        lignes.push(`  ${i + 1}. ${p.nom} — ${p.quantite} vendu(s)`);
      });
    }
    this.envoyer(lignes.join('\n'));
  }

  private envoyer(message: string): void {
    const info = this.boutique.getInfo();
    const numeros = [info.telephone, info.telephone2, info.telephone3]
      .filter((t): t is string => !!t?.trim());

    if (numeros.length === 0) return;

    numeros.forEach((num, i) => {
      setTimeout(() => {
        const clean = num.replace(/[\s()\-+]/g, '');
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
      }, i * 2500);
    });
  }

  private money(value: number, devise: string): string {
    return new Intl.NumberFormat('fr-FR').format(value || 0) + ' ' + devise;
  }
}
