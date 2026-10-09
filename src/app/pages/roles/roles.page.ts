import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import {
  ActionPermission,
  ModuleCatalogue,
  RoleBoutique,
  RoleService
} from '../../services/role.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmSheetService } from '../../services/confirm-sheet.service';

interface Personne {
  id: number;
  nomComplet: string;
  username: string;
  role: string;
  actif: boolean;
  roleBoutiqueId?: number | null;
}

interface Brouillon {
  id: number | null;
  nom: string;
  description: string;
  roleBase: 'ADMIN' | 'VENDEUR';
  systeme: boolean;
  verrouille: boolean;
  permissions: Set<string>;
}

const ACTIONS: ActionPermission[] = ['VOIR', 'GERER', 'SUPPRIMER'];

/** Un seul choix par partie, au lieu de 3 cases : plus simple à comprendre. */
export type Niveau = 'AUCUN' | 'VOIR' | 'MODIFIER' | 'TOUT';
const ACTIONS_PAR_NIVEAU: Record<Niveau, ActionPermission[]> = {
  AUCUN: [],
  VOIR: ['VOIR'],
  MODIFIER: ['VOIR', 'GERER'],
  TOUT: ['VOIR', 'GERER', 'SUPPRIMER']
};

/** Modèles prêts à l'emploi (on choisit, puis on ajuste si besoin). */
interface Modele {
  nom: string;
  description: string;
  icone: string;
  roleBase: 'ADMIN' | 'VENDEUR';
  niveaux: Record<string, Niveau>;
}
const MODELES: Modele[] = [
  {
    nom: 'Caissier', icone: 'cart-outline', roleBase: 'VENDEUR',
    description: 'Encaisse les ventes et suit les clients.',
    niveaux: { VENTES: 'TOUT', CLIENTS: 'MODIFIER', PRODUITS: 'VOIR', COMMANDES: 'VOIR' }
  },
  {
    nom: 'Magasinier', icone: 'cube-outline', roleBase: 'VENDEUR',
    description: 'Gère le stock et les produits, sans encaisser.',
    niveaux: { STOCK: 'TOUT', PRODUITS: 'MODIFIER', COMMANDES: 'VOIR' }
  },
  {
    nom: 'Caissier principal', icone: 'cash-outline', roleBase: 'ADMIN',
    description: 'Vend, gère la caisse et les dépenses. Ne voit pas les bénéfices, les salaires ni les réglages.',
    niveaux: { VENTES: 'TOUT', CLIENTS: 'MODIFIER', PRODUITS: 'VOIR', COMMANDES: 'VOIR', CAISSE: 'TOUT', DEPENSES: 'MODIFIER' }
  },
  {
    nom: 'Gérant adjoint', icone: 'briefcase-outline', roleBase: 'ADMIN',
    description: 'Presque tout, sauf le personnel (salaires) et les réglages de la boutique.',
    niveaux: {
      VENTES: 'TOUT', PRODUITS: 'TOUT', STOCK: 'TOUT', CLIENTS: 'TOUT', COMMANDES: 'TOUT', CAISSE: 'TOUT',
      DEPENSES: 'TOUT', FINANCES: 'TOUT', RAPPORTS: 'TOUT', FOURNISSEURS: 'TOUT', IA: 'TOUT'
    }
  }
];

/** Tous les codes de droits des parties données (ex: VENTES_VOIR). */
function codesDe(modules: ModuleCatalogue[]): string[] {
  return modules.reduce<string[]>((acc, m) => acc.concat(m.actions.map(a => a.code)), []);
}

/** Rôles et permissions (fonctionnalité ROLES_PERSONNALISES) — même logique que la page web. */
@Component({
  selector: 'app-roles',
  templateUrl: './roles.page.html',
  styleUrls: ['./roles.page.scss'],
  standalone: false
})
export class RolesPage implements OnInit {
  readonly actions = ACTIONS;
  readonly libellesActions: Record<ActionPermission, string> = {
    VOIR: 'Voir',
    GERER: 'Ajouter / modifier',
    SUPPRIMER: 'Supprimer / annuler'
  };

  readonly modeles = MODELES;
  readonly libellesNiveaux: Record<Niveau, string> = { AUCUN: 'Aucun', VOIR: 'Voir', MODIFIER: 'Modifier', TOUT: 'Tout' };
  catalogue: ModuleCatalogue[] = [];
  roles: RoleBoutique[] = [];
  personnes: Personne[] = [];
  chargement = true;
  erreur = '';
  enregistrement = false;
  brouillon: Brouillon | null = null;
  attributionEnCours: number | null = null;

  constructor(
    private roleService: RoleService,
    private auth: AuthService,
    private confirmSheet: ConfirmSheetService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = '';
    forkJoin({
      catalogue: this.roleService.catalogue(),
      roles: this.roleService.lister(),
      personnes: this.roleService.utilisateurs()
    }).subscribe({
      next: ({ catalogue, roles, personnes }) => {
        this.catalogue = catalogue;
        this.roles = roles;
        const moi = this.auth.getUserId();
        this.personnes = (personnes || []).filter(p => p.id !== moi) as Personne[];
        this.chargement = false;
      },
      error: err => {
        this.chargement = false;
        this.erreur = err?.error?.message || 'Impossible de charger les rôles.';
      }
    });
  }

  rafraichir(ev: any): void {
    this.charger();
    setTimeout(() => ev?.target?.complete(), 600);
  }

  libelleBase(base: string): string {
    return base === 'ADMIN' ? 'Basé sur Gérant' : 'Basé sur Vendeur';
  }

  // ---------------------------------------------------------------- édition

  ouvrir(r: RoleBoutique): void {
    this.brouillon = {
      id: r.id, nom: r.nom, description: r.description || '', roleBase: r.roleBase,
      systeme: r.systeme, verrouille: r.verrouille, permissions: new Set(r.permissions)
    };
  }

  nouveauRole(): void {
    this.brouillon = {
      id: null, nom: '', description: '', roleBase: 'VENDEUR', systeme: false, verrouille: false,
      permissions: new Set(['VENTES_VOIR', 'VENTES_GERER', 'PRODUITS_VOIR', 'CLIENTS_VOIR'])
    };
  }

  fermer(): void {
    this.brouillon = null;
  }

  // ---------------------------------------------------------------- choix simple par partie

  /** Choix proposés pour une partie (ex : Rapports n'a que « Voir »). */
  niveauxDe(m: ModuleCatalogue): Niveau[] {
    return (Object.keys(ACTIONS_PAR_NIVEAU) as Niveau[])
      .filter(n => ACTIONS_PAR_NIVEAU[n].every(a => this.aAction(m, a)))
      // « Tout » identique à « Modifier » (pas de suppression dans cette partie) : on le cache.
      .filter(n => !(n === 'TOUT' && !this.aAction(m, 'SUPPRIMER')))
      .filter(n => !(n === 'MODIFIER' && !this.aAction(m, 'GERER')));
  }

  niveau(m: ModuleCatalogue): Niveau {
    const b = this.brouillon;
    if (!b) return 'AUCUN';
    if (b.verrouille) return this.niveauxDe(m).slice(-1)[0];
    const a = (x: ActionPermission) => b.permissions.has(`${m.module}_${x}`);
    if (!a('VOIR')) return 'AUCUN';
    if (a('SUPPRIMER')) return 'TOUT';
    if (a('GERER')) return 'MODIFIER';
    return 'VOIR';
  }

  definirNiveau(m: ModuleCatalogue, n: Niveau): void {
    const b = this.brouillon;
    if (!b || b.verrouille) return;
    ACTIONS.forEach(x => b.permissions.delete(`${m.module}_${x}`));
    ACTIONS_PAR_NIVEAU[n].filter(x => this.aAction(m, x)).forEach(x => b.permissions.add(`${m.module}_${x}`));
  }

  /** Phrase simple : ce que le rôle peut faire, et ce qu'il ne voit pas. */
  resume(): { peut: string; nePeutPas: string } {
    const peut: string[] = [];
    const non: string[] = [];
    for (const m of this.modulesAffiches) {
      const n = this.niveau(m);
      if (n === 'AUCUN') non.push(m.libelle);
      else peut.push(`${m.libelle} (${this.libellesNiveaux[n].toLowerCase()})`);
    }
    return { peut: peut.join(', ') || "rien pour l'instant", nePeutPas: non.join(', ') };
  }

  /** Remplit le nouveau rôle à partir d'un modèle (nom, base et droits). */
  appliquerModele(mo: Modele): void {
    const b = this.brouillon;
    if (!b || b.id || b.systeme) return;
    b.nom = mo.nom;
    b.description = mo.description;
    b.roleBase = mo.roleBase;
    b.permissions = new Set();
    for (const m of this.modulesAffiches) {
      const n = mo.niveaux[m.module];
      if (n) this.definirNiveau(m, n);
    }
  }

  get modulesAffiches(): ModuleCatalogue[] {
    if (!this.brouillon) return [];
    return this.brouillon.roleBase === 'VENDEUR' ? this.catalogue.filter(m => m.accessibleVendeur) : this.catalogue;
  }

  changerBase(base: 'ADMIN' | 'VENDEUR'): void {
    if (!this.brouillon || this.brouillon.systeme) return;
    this.brouillon.roleBase = base;
    const permis = new Set(codesDe(this.modulesAffiches));
    this.brouillon.permissions = new Set([...this.brouillon.permissions].filter(c => permis.has(c)));
  }

  aAction(m: ModuleCatalogue, a: ActionPermission): boolean {
    return m.actions.some(x => x.action === a);
  }

  coche(m: ModuleCatalogue, a: ActionPermission): boolean {
    return !!this.brouillon?.permissions.has(`${m.module}_${a}`);
  }

  basculer(m: ModuleCatalogue, a: ActionPermission): void {
    const b = this.brouillon;
    if (!b || b.verrouille) return;
    const code = `${m.module}_${a}`;
    if (b.permissions.has(code)) {
      b.permissions.delete(code);
      if (a === 'VOIR') ACTIONS.forEach(x => b.permissions.delete(`${m.module}_${x}`));
    } else {
      b.permissions.add(code);
      if (a !== 'VOIR') b.permissions.add(`${m.module}_VOIR`);
    }
  }

  toutCocher(valeur: boolean): void {
    const b = this.brouillon;
    if (!b || b.verrouille) return;
    b.permissions = valeur ? new Set(codesDe(this.modulesAffiches)) : new Set();
  }

  enregistrer(): void {
    const b = this.brouillon;
    if (!b || b.verrouille) return;
    if (!b.nom.trim()) {
      this.toast('Donnez un nom au rôle (ex : Caissier).', 'warning');
      return;
    }
    const req = { nom: b.nom.trim(), description: b.description.trim(), roleBase: b.roleBase, permissions: [...b.permissions] };
    this.enregistrement = true;
    const obs = b.id ? this.roleService.modifier(b.id, req) : this.roleService.creer(req);
    obs.subscribe({
      next: () => {
        this.enregistrement = false;
        this.brouillon = null;
        this.toast('Rôle enregistré', 'success');
        this.charger();
      },
      error: err => {
        this.enregistrement = false;
        this.toast(err?.error?.message || 'Enregistrement impossible.', 'danger');
      }
    });
  }

  async supprimer(): Promise<void> {
    const b = this.brouillon;
    if (!b?.id || b.systeme) return;
    const ok = await this.confirmSheet.confirm({
      title: `Supprimer « ${b.nom} » ?`, message: 'Cette action est définitive.',
      confirmLabel: 'Supprimer', danger: true
    });
    if (!ok) return;
    this.roleService.supprimer(b.id).subscribe({
      next: () => { this.brouillon = null; this.toast('Rôle supprimé', 'success'); this.charger(); },
      error: err => this.toast(err?.error?.message || 'Suppression impossible.', 'danger')
    });
  }

  // ---------------------------------------------------------------- attribution

  roleDe(p: Personne): number {
    if (p.roleBoutiqueId) return p.roleBoutiqueId;
    const base = (p.role || '').replace('ROLE_', '');
    return this.roles.find(r => r.systeme && r.roleBase === base)?.id || 0;
  }

  async attribuer(p: Personne, roleId: number): Promise<void> {
    const role = this.roles.find(r => r.id === +roleId);
    if (!role || role.id === this.roleDe(p)) return;
    const versGerant = role.roleBase === 'ADMIN' && (p.role || '').replace('ROLE_', '') !== 'ADMIN';
    if (versGerant) {
      const ok = await this.confirmSheet.confirm({
        title: `Donner « ${role.nom} » à ${p.nomComplet} ?`,
        message: 'Ce rôle est basé sur Gérant : cette personne aura accès aux pages de gestion cochées pour ce rôle.',
        confirmLabel: 'Confirmer'
      });
      if (!ok) { this.reafficher(p); return; }
    }
    this.attributionEnCours = p.id;
    this.roleService.attribuer(p.id, role.id).subscribe({
      next: res => {
        this.attributionEnCours = null;
        p.role = res.role;
        p.roleBoutiqueId = res.roleBoutiqueId;
        this.toast(`${p.nomComplet} : ${res.roleNom}`, 'success');
        this.roleService.lister().subscribe({ next: r => this.roles = r, error: () => {} });
      },
      error: err => {
        this.attributionEnCours = null;
        this.reafficher(p);
        this.toast(err?.error?.message || 'Changement impossible.', 'danger');
      }
    });
  }

  private reafficher(p: Personne): void {
    this.personnes = this.personnes.map(x => (x === p ? { ...x } : x));
  }

  private async toast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await t.present();
  }

  /** Bouton visible seulement si le rôle de la personne permet l'action (rôles personnalisés). */
  peut(module: string, action: ActionPermission): boolean {
    return this.roleService.peut(module, action);
  }
}
