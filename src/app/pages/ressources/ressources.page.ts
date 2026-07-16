import { Component } from '@angular/core';

interface Fonctionnalite {
  icon: string;
  titreKey: string;
  descKey: string;
  couleur: string;
}

@Component({
  selector: 'app-ressources',
  templateUrl: './ressources.page.html',
  styleUrls: ['./ressources.page.scss'],
  standalone: false
})
export class RessourcesPage {

  readonly version = '1.0.0';

  fonctionnalites: Fonctionnalite[] = [
    { icon: 'cart-outline',            titreKey: 'RESSOURCES.VENTES_TITRE',      descKey: 'RESSOURCES.VENTES_DESC',      couleur: '#1a56db' },
    { icon: 'cube-outline',            titreKey: 'RESSOURCES.STOCK_TITRE',       descKey: 'RESSOURCES.STOCK_DESC',       couleur: '#059669' },
    { icon: 'people-outline',          titreKey: 'RESSOURCES.CLIENTS_TITRE',     descKey: 'RESSOURCES.CLIENTS_DESC',     couleur: '#7c3aed' },
    { icon: 'bar-chart-outline',       titreKey: 'RESSOURCES.RAPPORTS_TITRE',    descKey: 'RESSOURCES.RAPPORTS_DESC',    couleur: '#d97706' },
    { icon: 'sparkles-outline',        titreKey: 'RESSOURCES.IA_TITRE',          descKey: 'RESSOURCES.IA_DESC',          couleur: '#dc2626' },
    { icon: 'swap-horizontal-outline', titreKey: 'RESSOURCES.TRANSFERTS_TITRE',  descKey: 'RESSOURCES.TRANSFERTS_DESC',  couleur: '#0891b2' },
    { icon: 'receipt-outline',         titreKey: 'RESSOURCES.COMMANDES_TITRE',   descKey: 'RESSOURCES.COMMANDES_DESC',   couleur: '#2563eb' },
    { icon: 'business-outline',        titreKey: 'RESSOURCES.FOURNISSEURS_TITRE',descKey: 'RESSOURCES.FOURNISSEURS_DESC',couleur: '#b45309' }
  ];

  ouvrirLien(url: string): void {
    window.open(url, '_blank');
  }
}
