import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Client, ClientService } from '../../services/client.service';
import { Compte, CompteService, TypeOperationCompte } from '../../services/compte.service';
import { DetteAncienne, DetteAncienneService } from '../../services/dette-ancienne.service';
import { Employe, EmployeService } from '../../services/employe.service';
import { Facture, FactureService, LigneFactureRequest } from '../../services/facture.service';
import { PaiementEmploye, PaiementEmployeService } from '../../services/paiement-employe.service';
import { Fournisseur, ProductService, Produit } from '../../services/product.service';
import { AppUser, UserService } from '../../services/user.service';
import { MobileResourceService, ResourceConfig } from '../../services/mobile-resource.service';
import { DepotClient, DepotClientRequest, DepotGarde, DepotGardeService, RetraitDepotRequest } from '../../services/depot-garde.service';
import { ObjectifFournisseur, ObjectifFournisseurService, ObjectifFournisseurRequest, MOIS_LABELS } from '../../services/objectif-fournisseur.service';

type ResourceType = 'factures' | 'comptes' | 'dettes' | 'employes' | 'paiement-employe' | 'fournisseurs' | 'vendeurs' | 'depots-garde' | 'objectifs-fournisseur';

@Component({
  selector: 'app-resources',
  templateUrl: './resources.page.html',
  styleUrls: ['./resources.page.scss'],
  standalone: false
})
export class ResourcesPage {
  type: ResourceType = 'factures';
  config?: ResourceConfig;
  items: any[] = [];
  clients: Client[] = [];
  products: Produit[] = [];
  employees: Employe[] = [];
  comptes: Compte[] = [];
  fournisseurs: Fournisseur[] = [];
  query = '';
  showForm = false;
  selected?: any;

  factureForm = {
    id: 0,
    clientId: undefined as number | undefined,
    clientNom: '',
    clientPrenom: '',
    clientTelephone: '',
    clientAdresse: '',
    notes: ''
  };
  factureLines: LigneFactureRequest[] = [];
  factureLigneEnCours = {
    produitId: undefined as number | undefined,
    designation: '',
    quantite: 1,
    prixUnitaire: 0,
    remisePourcentage: 0,
    modeLibre: false
  };

  compteForm = { id: 0, nomBanque: '', numeroCompte: '', agence: '', titulaire: '', soldeInitial: 0, description: '' };
  compteOperation = { compteId: 0, type: 'VERSEMENT' as TypeOperationCompte, montant: 0, motif: '', reference: '' };

  detteForm = { id: 0, clientId: 0, montant: 0, dateCredit: new Date().toISOString().split('T')[0], description: '' };
  detteReglement = { detteId: 0, montantPaye: 0, modePaiement: 'ESPECES', referencePaiement: '', observations: '' };

  employeForm = { id: 0, nom: '', prenom: '', poste: '', salaireMensuel: 0, telephone: '', observation: '', statut: 'ACTIF' as 'ACTIF' | 'INACTIF', dateEmbauche: '' };
  paiementForm = { employeId: 0, nombreMois: 1, periodeDebut: new Date().toISOString().split('T')[0], periodeFin: '', observation: '' };

  fournisseurForm = { id: 0, nom: '', code: '', adresse: '', telephone: '', email: '', description: '', actif: true };
  achatForm = { fournisseurId: 0, produitId: 0, quantite: 1, prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' };
  paiementFournisseur = { fournisseurId: 0, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
  avanceFournisseur = { fournisseurId: 0, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
  retourAchatForm = { achatId: 0, produitId: 0, quantiteRetournee: 1, prixAchatUnitaire: 0, motif: '' };
  fournisseurDetails = {
    situation: undefined as any,
    achats: [] as any[],
    paiements: [] as any[],
    avances: [] as any[],
    soldeAvance: 0
  };

  // Fournisseurs redesign
  fournisseurSegment: 'liste' | 'achats' | 'paiements' = 'liste';
  selectedFournisseur?: Fournisseur;
  showAchatModal = false;
  showPaiementModal = false;
  showFournisseurFormModal = false;
  loadingFournisseurDetails = false;

  userForm = { id: 0, username: '', password: '', nomComplet: '', email: '', telephone: '', role: 'VENDEUR' as 'ADMIN' | 'VENDEUR' };

  // Objectifs fournisseurs
  objectifForm: ObjectifFournisseurRequest & { id?: number } = {
    fournisseurId: 0, mois: new Date().getMonth() + 1, annee: new Date().getFullYear(),
    objectifQuantite: 0, bonusParUnite: 0, quantiteAtteinte: 0, quantiteBonusRecue: 0
  };
  moisLabels = MOIS_LABELS;

  // Dépôts garde
  depotForm = { id: 0, depotClientId: undefined as number | undefined, nom: '', prenom: '', numero: '', montant: 0, observation: '' };
  retraitDepotForm: RetraitDepotRequest = { montant: 0, observation: '' };
  selectedDepot?: DepotGarde;
  showDepotRetraitModal = false;
  showDepotDetailModal = false;
  depotDetail?: DepotGarde;

  // Clients dépôt
  depotClients: DepotClient[] = [];
  depotClientSearch = '';
  filteredDepotClients: DepotClient[] = [];
  selectedDepotClient?: DepotClient;
  showNewDepotClientForm = false;
  depotClientForm: DepotClientRequest = { nom: '', prenom: '', numero: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private resourceMeta: MobileResourceService,
    private auth: AuthService,
    public factureService: FactureService,
    public compteService: CompteService,
    public detteService: DetteAncienneService,
    private employeService: EmployeService,
    private paiementEmployeService: PaiementEmployeService,
    private productService: ProductService,
    private clientService: ClientService,
    private userService: UserService,
    private depotGardeService: DepotGardeService,
    public objectifFournisseurService: ObjectifFournisseurService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    const type = this.route.snapshot.paramMap.get('type') as ResourceType | null;
    const config = this.resourceMeta.getConfig(type);
    if (!type || !config) {
      this.router.navigateByUrl('/home');
      return;
    }
    this.type = type;
    this.config = config;
    this.loadSupportData();
    this.load();
  }

  load(event?: any): void {
    const done = () => event?.target?.complete();
    const fail = (error: any) => {
      done();
      this.presentToast(error?.error?.message || error.message || 'Chargement impossible', 'danger');
    };

    switch (this.type) {
      case 'factures':
        (this.query ? this.factureService.obtenirFacturesParClient(this.query) : this.factureService.obtenirToutesFactures())
          .subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
      case 'comptes':
        this.compteService.getTousLesComptes().subscribe({ next: items => { this.items = items; this.comptes = items; done(); }, error: fail });
        break;
      case 'dettes':
        (this.query ? this.detteService.rechercherDettes(this.query) : this.detteService.getAllDettes())
          .subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
      case 'employes':
        this.employeService.getTous().subscribe({ next: items => { this.items = items; this.employees = items; done(); }, error: fail });
        break;
      case 'paiement-employe':
        this.paiementEmployeService.getTous().subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
      case 'fournisseurs':
        (this.query ? this.productService.searchFournisseurs(this.query) : this.productService.getAllFournisseurs())
          .subscribe({ next: items => { this.items = items; this.fournisseurs = items; done(); }, error: fail });
        break;
      case 'depots-garde':
        (this.query ? this.depotGardeService.rechercher(this.query) : this.depotGardeService.getTous())
          .subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
      case 'vendeurs':
        (this.query ? this.userService.searchUsers(this.query) : this.userService.getAllUsers())
          .subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
      case 'objectifs-fournisseur':
        this.objectifFournisseurService.getTous()
          .subscribe({ next: items => { this.items = items; done(); }, error: fail });
        break;
    }
  }

  startCreate(): void {
    if (this.type === 'fournisseurs') {
      this.openNewFournisseur();
      return;
    }
    this.selected = undefined;
    this.resetForms();
    this.showForm = true;
  }

  edit(item: any): void {
    this.selected = item;
    this.showForm = true;
    if (this.type === 'factures') this.fillFacture(item);
    if (this.type === 'comptes') this.compteForm = { id: item.id, nomBanque: item.nomBanque || item.nom || '', numeroCompte: item.numeroCompte || '', agence: item.agence || '', titulaire: item.titulaire || '', soldeInitial: item.soldeInitial || 0, description: item.description || '' };
    if (this.type === 'dettes') this.detteForm = { id: item.id, clientId: item.clientId || 0, montant: item.montantInitial || item.montant || 0, dateCredit: this.toDateInput(item.dateCredit), description: item.description || '' };
    if (this.type === 'employes') this.employeForm = { id: item.id, nom: item.nom || '', prenom: item.prenom || '', poste: item.poste || '', salaireMensuel: item.salaireMensuel || 0, telephone: item.telephone || '', observation: item.observation || '', statut: item.statut || 'ACTIF', dateEmbauche: this.toDateInput(item.dateEmbauche) };
    if (this.type === 'fournisseurs') this.fournisseurForm = { id: item.id, nom: item.nom || '', code: item.code || '', adresse: item.adresse || '', telephone: item.telephone || '', email: item.email || '', description: item.description || '', actif: item.actif !== false };
    if (this.type === 'vendeurs') this.userForm = { id: item.id, username: item.username || '', password: '', nomComplet: item.nomComplet || '', email: item.email || '', telephone: item.telephone || '', role: item.role || 'VENDEUR' };
    if (this.type === 'depots-garde') this.depotForm = { id: item.id, depotClientId: item.depotClientId || undefined, nom: item.nom || '', prenom: item.prenom || '', numero: item.numero || '', montant: item.montantInitial || 0, observation: item.observation || '' };
    if (this.type === 'objectifs-fournisseur') this.objectifForm = { id: item.id, fournisseurId: item.fournisseurId || 0, produitId: item.produitId || undefined, mois: item.mois || new Date().getMonth() + 1, annee: item.annee || new Date().getFullYear(), objectifQuantite: item.objectifQuantite || 0, bonusParUnite: item.bonusParUnite || 0, quantiteAtteinte: item.quantiteAtteinte || 0, quantiteBonusRecue: item.quantiteBonusRecue || 0, observation: item.observation || '' };
  }

  save(): void {
    switch (this.type) {
      case 'factures': void this.saveFacture(); break;
      case 'comptes': this.saveCompte(); break;
      case 'dettes': this.saveDette(); break;
      case 'employes': this.saveEmploye(); break;
      case 'fournisseurs': this.saveFournisseur(); break;
      case 'vendeurs': this.saveUser(); break;
      case 'depots-garde': this.saveDepot(); break;
      case 'objectifs-fournisseur': this.saveObjectif(); break;
      default: this.presentToast('Utilisez les actions de cette page', 'danger');
    }
  }

  saveCompteOperation(): void {
    this.compteService.enregistrerOperation({ ...this.compteOperation, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => this.afterAction('Opération enregistrée'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Opération impossible', 'danger')
    });
  }

  transferCaisseBanque(): void {
    this.compteService.transfererCaisseVersBanque({ ...this.compteOperation, compteId: this.compteOperation.compteId, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => this.afterAction('Transfert effectué'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Transfert impossible', 'danger')
    });
  }

  saveDetteReglement(): void {
    if (!this.detteReglement.detteId || this.detteReglement.detteId === 0) {
      this.presentToast('Sélectionnez une dette', 'danger'); return;
    }
    if (!this.detteReglement.montantPaye || this.detteReglement.montantPaye <= 0) {
      this.presentToast('Montant invalide', 'danger'); return;
    }
    this.detteService.enregistrerReglement({ ...this.detteReglement, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => this.afterAction('Règlement enregistré'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Règlement impossible', 'danger')
    });
  }

  payEmploye(): void {
    if (!this.paiementForm.employeId) {
      this.presentToast('Sélectionnez un employé', 'danger'); return;
    }
    if (!this.paiementForm.periodeDebut) {
      this.presentToast('La période de début est obligatoire', 'danger'); return;
    }
    if (!this.paiementForm.nombreMois || this.paiementForm.nombreMois < 1 || this.paiementForm.nombreMois > 3) {
      this.presentToast('Le nombre de mois doit être entre 1 et 3', 'danger'); return;
    }
    this.paiementEmployeService.payer({ ...this.paiementForm, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => this.afterAction('Paiement employé enregistré'),
      error: error => this.presentToast(error?.error?.message || error?.error?.message || error.message || 'Paiement impossible', 'danger')
    });
  }

  saveAchatFournisseur(): void {
    this.productService.creerAchat({
      fournisseurId: this.achatForm.fournisseurId,
      lignes: [{
        produitId: this.achatForm.produitId,
        quantite: this.achatForm.quantite,
        prixAchatUnitaire: this.achatForm.prixAchatUnitaire,
        prixVente: this.achatForm.prixVente
      }],
      montantPaye: this.achatForm.montantPaye,
      commentaire: this.achatForm.commentaire,
      utilisateurId: this.auth.getUserId(),
      modePaiementImmediat: 'ESPECES'
    }).subscribe({
      next: () => this.afterAction('Achat fournisseur enregistré'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Achat impossible', 'danger')
    });
  }

  payFournisseur(): void {
    this.productService.payerFournisseur({ ...this.paiementFournisseur, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => this.afterAction('Paiement fournisseur enregistré'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Paiement impossible', 'danger')
    });
  }

  saveAvanceFournisseur(): void {
    this.productService.enregistrerAvanceFournisseur({ ...this.avanceFournisseur, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.afterAction('Avance fournisseur enregistrée');
        this.loadFournisseurDetails(this.avanceFournisseur.fournisseurId);
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Avance impossible', 'danger')
    });
  }

  loadFournisseurDetails(fournisseurId?: number): void {
    const id = Number(fournisseurId || this.achatForm.fournisseurId || this.paiementFournisseur.fournisseurId || this.avanceFournisseur.fournisseurId || 0);
    if (!id) {
      this.presentToast('Sélectionnez un fournisseur', 'danger');
      return;
    }

    this.productService.getSituationFournisseur(id).subscribe({
      next: situation => this.fournisseurDetails.situation = situation,
      error: error => this.presentToast(error?.error?.message || error.message || 'Situation fournisseur impossible', 'danger')
    });
    this.productService.getHistoriqueAchats(id).subscribe(achats => this.fournisseurDetails.achats = achats);
    this.productService.getHistoriquePaiements(id).subscribe(paiements => this.fournisseurDetails.paiements = paiements);
    this.productService.getHistoriqueAvancesFournisseur(id).subscribe(avances => this.fournisseurDetails.avances = avances);
    this.productService.getSoldeAvanceFournisseur(id).subscribe(solde => this.fournisseurDetails.soldeAvance = solde);
  }

  saveRetourAchat(): void {
    this.productService.effectuerRetourAchat({
      achatId: this.retourAchatForm.achatId,
      motif: this.retourAchatForm.motif,
      utilisateurId: this.auth.getUserId(),
      lignes: [{
        produitId: this.retourAchatForm.produitId,
        quantiteRetournee: this.retourAchatForm.quantiteRetournee,
        prixAchatUnitaire: this.retourAchatForm.prixAchatUnitaire
      }]
    }).subscribe({
      next: () => this.afterAction('Retour achat enregistré'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Retour achat impossible', 'danger')
    });
  }

  async cancelAchatFournisseur(): Promise<void> {
    if (!this.retourAchatForm.achatId) {
      this.presentToast('Indiquez le numéro achat', 'danger');
      return;
    }
    this.confirmDelete(() => this.productService.annulerAchatFournisseur(this.retourAchatForm.achatId, this.auth.getUserId()).subscribe({
      next: () => this.afterAction('Achat fournisseur annulé'),
      error: error => this.presentToast(error.message || 'Annulation impossible', 'danger')
    }));
  }

  async action(item: any, kind: string): Promise<void> {
    if (kind === 'print') this.factureService.imprimerFacture(item as Facture);
    if (kind === 'pdf-dl') window.open('/api/caisse/factures/' + item.id + '/pdf', '_blank');
    if (kind === 'pdf-view') window.open('/api/caisse/factures/' + item.id + '/pdf/view', '_blank');
    if (kind === 'validate') this.factureService.validerFacture(item.id).subscribe({ next: () => this.afterAction('Facture validée'), error: e => this.presentToast(e.message, 'danger') });
    if (kind === 'cancel-facture') this.factureService.annulerFacture(item.id).subscribe({ next: () => this.afterAction('Facture annulée'), error: e => this.presentToast(e.message, 'danger') });
    if (kind === 'delete-facture') this.confirmDelete(() => this.factureService.supprimerFacture(item.id).subscribe({ next: () => this.afterAction('Facture supprimée'), error: e => this.presentToast(e.message, 'danger') }));
    if (kind === 'delete-dette') this.confirmDelete(() => this.detteService.supprimerDette(item.id).subscribe({ next: () => this.afterAction('Dette supprimée'), error: e => this.presentToast(e.message, 'danger') }));
    if (kind === 'activate-employe') this.employeService.activer(item.id).subscribe({ next: () => this.afterAction('Employé activé'), error: e => this.presentToast(e.message, 'danger') });
    if (kind === 'deactivate-employe') this.employeService.desactiver(item.id).subscribe({ next: () => this.afterAction('Employé désactivé'), error: e => this.presentToast(e.message, 'danger') });
    if (kind === 'delete-employe') this.confirmDelete(() => this.employeService.supprimer(item.id).subscribe({ next: () => this.afterAction('Employé supprimé'), error: e => this.presentToast(e.message, 'danger') }));
    if (kind === 'cancel-paie') this.promptCancelPaiement(item as PaiementEmploye);
    if (kind === 'delete-fournisseur') this.confirmDelete(() => this.productService.deleteFournisseur(item.id).subscribe({ next: () => this.afterAction('Fournisseur supprimé'), error: e => this.presentToast(e.message, 'danger') }));
    if (kind === 'delete-user') this.confirmDelete(() => this.userService.deleteUser(item.id).subscribe({ next: () => this.afterAction('Utilisateur supprimé'), error: e => this.presentToast(e.message, 'danger') }));
    if (kind === 'depot-retrait') this.openDepotRetrait(item as DepotGarde);
    if (kind === 'depot-detail') this.openDepotDetail(item as DepotGarde);
    if (kind === 'depot-cloturer') this.confirmCloturerDepot(item as DepotGarde);
    if (kind === 'objectif-valider') this.confirmerValiderObjectif(item as ObjectifFournisseur);
    if (kind === 'objectif-delete') this.confirmDelete(() =>
      this.objectifFournisseurService.supprimer(item.id).subscribe({
        next: () => this.afterAction('Objectif supprimé'),
        error: error => this.presentToast(error?.error?.message || error.message || 'Suppression impossible', 'danger')
      }));
  }

  title(item: any): string {
    if (this.type === 'factures') return item.numeroFacture || `Facture #${item.id}`;
    if (this.type === 'comptes') return item.nomBanque || item.nom || `Compte #${item.id}`;
    if (this.type === 'dettes') return `${item.clientNom || 'Client'} ${item.clientPrenom || ''}`.trim();
    if (this.type === 'employes') return item.nomComplet || `${item.prenom || ''} ${item.nom || ''}`.trim();
    if (this.type === 'paiement-employe') return item.employeNomComplet || `Paiement #${item.id}`;
    if (this.type === 'fournisseurs') return item.nom || `Fournisseur #${item.id}`;
    if (this.type === 'vendeurs') return item.nomComplet || item.username;
    if (this.type === 'depots-garde') return item.nomComplet || `${item.prenom || ''} ${item.nom || ''}`.trim();
    if (this.type === 'objectifs-fournisseur') return `${item.fournisseurNom} — ${this.moisLabels[item.mois] || ''} ${item.annee}`;
    return item.nom || item.numero || `#${item.id}`;
  }

  subtitle(item: any): string {
    if (this.type === 'factures') return `${item.clientNom || 'Client divers'} · ${this.factureService.getStatutText(item.statut)}`;
    if (this.type === 'comptes') return `${item.numeroCompte || '-'} · ${item.actif ? 'Actif' : 'Inactif'}`;
    if (this.type === 'dettes') return `${this.detteService.getStatutDette(item)} · ${this.date(item.dateCredit)}`;
    if (this.type === 'employes') return `${item.poste || '-'} · ${item.statut}`;
    if (this.type === 'paiement-employe') return `${item.nombreMois} mois · ${item.statut}`;
    if (this.type === 'fournisseurs') return `${item.telephone || '-'} · ${item.email || '-'}`;
    if (this.type === 'vendeurs') return `${item.username} · ${item.role}`;
    if (this.type === 'depots-garde') return `${item.numero} · Restant: ${this.depotGardeService.formatMontant(item.montantRestant)} · ${item.statut}`;
    if (this.type === 'objectifs-fournisseur') return `Bonus: ${this.objectifFournisseurService.formatMontant(item.bonusCalcule)} · ${item.statut === 'ATTEINT' ? 'Atteint' : 'Non atteint'}`;
    return '';
  }

  amount(item: any): string {
    const value =
      item.montantTotal ?? item.soldeActuel ?? item.montantRestant ?? item.salaireMensuel ?? item.prixVente ?? item.montant ?? item.solde ?? 0;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  date(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  private loadSupportData(): void {
    this.clientService.getAll().subscribe(clients => this.clients = clients);
    this.productService.getProducts().subscribe(products => this.products = products);
    this.employeService.getTous().subscribe(employees => this.employees = employees);
    this.compteService.getTousLesComptes().subscribe(comptes => this.comptes = comptes);
    this.productService.getAllFournisseurs().subscribe(fournisseurs => this.fournisseurs = fournisseurs);
    this.depotGardeService.getTousClients().subscribe(clients => this.depotClients = clients);
  }

  private async saveFacture(): Promise<void> {
    if (this.factureLines.length === 0) {
      this.presentToast('Ajoutez au moins un article', 'danger');
      return;
    }
    const clientLabel = this.factureForm.clientNom || 'Client divers';
    const total = this.getTotalFacture();
    const isEdit = !!this.factureForm.id;

    const alert = await this.alertCtrl.create({
      header: isEdit ? 'Modifier la facture ?' : 'Créer la facture ?',
      message: `Client : ${clientLabel}\n${this.factureLines.length} article(s)\nTotal : ${total.toLocaleString()} FCFA`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: isEdit ? 'Modifier' : 'Créer',
          cssClass: 'alert-btn-primary',
          handler: () => {
            const payload = {
              clientId: this.factureForm.clientId,
              clientNom: this.factureForm.clientNom,
              clientPrenom: this.factureForm.clientPrenom,
              clientTelephone: this.factureForm.clientTelephone,
              clientAdresse: this.factureForm.clientAdresse,
              notes: this.factureForm.notes,
              utilisateurId: this.auth.getUserId(),
              lignes: this.factureLines.map(l => ({
                produitId: l.produitId,
                designation: l.designation,
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
                remisePourcentage: l.remisePourcentage || 0
              }))
            };
            const request = isEdit
              ? this.factureService.modifierFacture(this.factureForm.id!, payload)
              : this.factureService.creerFacture(payload);
            request.subscribe({
              next: () => this.afterAction('Facture enregistrée'),
              error: error => this.presentToast(error?.error?.message || error.message || 'Facture impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private saveCompte(): void {
    const { id, ...payload } = this.compteForm;
    const request = id ? this.compteService.modifierCompte(id, payload) : this.compteService.creerCompte(payload);
    request.subscribe({ next: () => this.afterAction('Compte enregistré'), error: error => this.presentToast(error?.error?.message || error.message || 'Compte impossible', 'danger') });
  }

  private saveDette(): void {
    if (!this.detteForm.clientId || this.detteForm.clientId === 0) {
      this.presentToast('Sélectionnez un client', 'danger'); return;
    }
    if (!this.detteForm.montant || this.detteForm.montant <= 0) {
      this.presentToast('Montant invalide', 'danger'); return;
    }
    const { id, ...payload } = this.detteForm;
    const request = id ? this.detteService.modifierDette(id, payload) : this.detteService.creerDette(payload);
    request.subscribe({ next: () => this.afterAction('Dette enregistrée'), error: error => this.presentToast(error?.error?.message || error.message || 'Dette impossible', 'danger') });
  }

  private saveEmploye(): void {
    if (!this.employeForm.nom.trim()) {
      this.presentToast('Le nom est obligatoire', 'danger'); return;
    }
    if (!this.employeForm.poste.trim()) {
      this.presentToast('Le poste est obligatoire', 'danger'); return;
    }
    const { id: empId, ...empRest } = this.employeForm;
    const payload = { ...empRest, dateEmbauche: this.employeForm.dateEmbauche || undefined };
    const request = empId
      ? this.employeService.modifier(empId, payload)
      : this.employeService.creer(payload);
    request.subscribe({ next: () => this.afterAction('Employé enregistré'), error: error => this.presentToast(error?.error?.message || error.message || 'Employé impossible', 'danger') });
  }

  private saveFournisseur(): void {
    const request = this.fournisseurForm.id ? this.productService.updateFournisseur(this.fournisseurForm.id, this.fournisseurForm) : this.productService.createFournisseur(this.fournisseurForm);
    request.subscribe({ next: () => this.afterAction('Fournisseur enregistré'), error: error => this.presentToast(error?.error?.message || error.message || 'Fournisseur impossible', 'danger') });
  }

  private saveUser(): void {
    if (!this.userForm.username.trim()) {
      this.presentToast('Le nom d\'utilisateur est obligatoire', 'danger'); return;
    }
    if (!this.userForm.id && !this.userForm.password.trim()) {
      this.presentToast('Le mot de passe est obligatoire', 'danger'); return;
    }
    if (!this.userForm.nomComplet.trim()) {
      this.presentToast('Le nom complet est obligatoire', 'danger'); return;
    }
    const { id: userId, ...userPayload } = this.userForm;
    const request = userId
      ? this.userService.updateUser(userId, userPayload)
      : this.userService.createUser(userPayload);
    request.subscribe({ next: () => this.afterAction('Utilisateur enregistré'), error: error => this.presentToast(error?.error?.message || error.message || 'Utilisateur impossible', 'danger') });
  }

  private fillFacture(facture: Facture): void {
    this.factureForm = {
      id: facture.id,
      clientId: facture.clientId,
      clientNom: facture.clientNom || '',
      clientPrenom: facture.clientPrenom || '',
      clientTelephone: facture.clientTelephone || '',
      clientAdresse: facture.clientAdresse || '',
      notes: facture.notes || ''
    };
    this.factureLines = (facture.lignes || []).map(l => ({
      produitId: l.produitId,
      designation: l.designation || l.produitNom || 'Article',
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remisePourcentage: l.remisePourcentage || 0,
      remiseMontant: l.remiseMontant || 0
    }));
    this.factureLigneEnCours = { produitId: undefined, designation: '', quantite: 1, prixUnitaire: 0, remisePourcentage: 0, modeLibre: false };
  }

  onFactureProduitChange(): void {
    const p = this.products.find(prod => prod.id === Number(this.factureLigneEnCours.produitId));
    this.factureLigneEnCours.prixUnitaire = p?.prixVente || 0;
  }

  addFactureLigne(): void {
    const l = this.factureLigneEnCours;
    if (!l.modeLibre) {
      if (!l.produitId) { this.presentToast('Sélectionnez un produit ou activez le mode libre', 'danger'); return; }
      const product = this.products.find(p => p.id === Number(l.produitId));
      const ligne: LigneFactureRequest = {
        produitId: l.produitId,
        designation: product?.nom || l.designation || 'Produit',
        quantite: l.quantite || 1,
        prixUnitaire: l.prixUnitaire || product?.prixVente || 0,
        remisePourcentage: l.remisePourcentage || 0
      };
      this.factureLines.push(ligne);
    } else {
      if (!l.designation?.trim()) { this.presentToast('Désignation requise', 'danger'); return; }
      if (!l.prixUnitaire || l.prixUnitaire <= 0) { this.presentToast('Prix requis', 'danger'); return; }
      this.factureLines.push({
        produitId: undefined,
        designation: l.designation,
        quantite: l.quantite || 1,
        prixUnitaire: l.prixUnitaire,
        remisePourcentage: l.remisePourcentage || 0
      });
    }
    this.factureLigneEnCours = { produitId: undefined, designation: '', quantite: 1, prixUnitaire: 0, remisePourcentage: 0, modeLibre: l.modeLibre };
    this.presentToast('Article ajouté ✓');
  }

  removeFactureLigne(i: number): void {
    this.factureLines.splice(i, 1);
  }

  getTotalFacture(): number {
    return this.factureLines.reduce((sum, l) => {
      const remise = l.remisePourcentage ? l.prixUnitaire * (l.remisePourcentage / 100) : 0;
      return sum + (l.prixUnitaire - remise) * l.quantite;
    }, 0);
  }

  getFactureLigneLabel(l: LigneFactureRequest): string {
    return l.designation || 'Article';
  }

  telechargerFacturePdf(item: Facture): void {
    window.open('/api/caisse/factures/' + item.id + '/pdf', '_blank');
  }

  private saveObjectif(): void {
    if (!this.objectifForm.fournisseurId) {
      this.presentToast('Sélectionnez un fournisseur', 'danger'); return;
    }
    if (!this.objectifForm.objectifQuantite || this.objectifForm.objectifQuantite <= 0) {
      this.presentToast("L'objectif de quantité doit être supérieur à 0", 'danger'); return;
    }
    const { id, ...payload } = this.objectifForm as any;
    const request = id
      ? this.objectifFournisseurService.modifier(id, payload)
      : this.objectifFournisseurService.creer(payload);
    request.subscribe({
      next: (result) => {
        this.showForm = false;
        this.load();
        if (result.statut === 'ATTEINT') {
          this.alertObjectifAtteint(result);
        } else {
          this.presentToast(id ? 'Objectif modifié' : 'Objectif enregistré');
        }
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Enregistrement impossible', 'danger')
    });
  }

  private async alertObjectifAtteint(objectif: ObjectifFournisseur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '🎯 Objectif atteint !',
      message: `${objectif.fournisseurNom} — ${this.moisLabels[objectif.mois] || ''} ${objectif.annee}\n\nVous pouvez valider pour ajouter les bonus au stock.`,
      buttons: [
        { text: 'Plus tard', role: 'cancel' },
        {
          text: 'Valider maintenant',
          cssClass: 'alert-btn-primary',
          handler: () => { setTimeout(() => this.confirmerValiderObjectif(objectif), 300); }
        }
      ]
    });
    await alert.present();
  }

  private async alertBonusAjoute(objectif: ObjectifFournisseur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '✅ Stock mis à jour !',
      message: `${objectif.quantiteBonusRecue} unité(s) de "${objectif.produitNom || 'produit'}" ont été ajoutées au stock.`,
      buttons: ['OK']
    });
    await alert.present();
  }

  async confirmerValiderObjectif(objectif: ObjectifFournisseur): Promise<void> {
    if (objectif.statut !== 'ATTEINT') {
      this.presentToast("Seuls les objectifs atteints peuvent être validés", 'danger'); return;
    }
    if (!objectif.produitId) {
      this.presentToast('Associez un produit avant de valider', 'danger'); return;
    }
    if (!objectif.quantiteBonusRecue || objectif.quantiteBonusRecue <= 0) {
      this.presentToast('Renseignez la quantité bonus reçue', 'danger'); return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Valider le bonus ?',
      message: `${objectif.quantiteBonusRecue} unités de "${objectif.produitNom}" seront ajoutées au stock.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider',
          handler: () => this.objectifFournisseurService.valider(objectif.id).subscribe({
            next: (result) => { this.load(); this.alertBonusAjoute(result); },
            error: error => this.presentToast(error?.error?.message || error.message || 'Validation impossible', 'danger')
          })
        }
      ]
    });
    await alert.present();
  }

  searchDepotClients(): void {
    const q = this.depotClientSearch.trim().toLowerCase();
    if (!q) { this.filteredDepotClients = []; return; }
    this.filteredDepotClients = this.depotClients.filter(c =>
      c.nomComplet.toLowerCase().includes(q) || c.numero.includes(q)
    );
  }

  selectDepotClient(client: DepotClient): void {
    this.selectedDepotClient = client;
    this.depotForm.depotClientId = client.id;
    this.depotClientSearch = client.nomComplet;
    this.filteredDepotClients = [];
    this.showNewDepotClientForm = false;
  }

  clearDepotClient(): void {
    this.selectedDepotClient = undefined;
    this.depotForm.depotClientId = undefined;
    this.depotClientSearch = '';
    this.filteredDepotClients = [];
  }

  saveNewDepotClient(): void {
    if (!this.depotClientForm.nom.trim()) {
      this.presentToast('Le nom est obligatoire', 'danger'); return;
    }
    if (!this.depotClientForm.numero.trim()) {
      this.presentToast('Le téléphone est obligatoire', 'danger'); return;
    }
    this.depotGardeService.creerClient(this.depotClientForm).subscribe({
      next: (client) => {
        this.depotClients.push(client);
        this.selectDepotClient(client);
        this.showNewDepotClientForm = false;
        this.depotClientForm = { nom: '', prenom: '', numero: '' };
        this.presentToast('Client créé ✓');
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Création impossible', 'danger')
    });
  }

  private saveDepot(): void {
    if (!this.depotForm.id && (!this.depotForm.montant || this.depotForm.montant <= 0)) {
      this.presentToast('Le montant doit être supérieur à 0', 'danger'); return;
    }
    let payload: any;
    if (this.depotForm.depotClientId) {
      payload = { depotClientId: this.depotForm.depotClientId, montant: this.depotForm.montant, observation: this.depotForm.observation };
    } else {
      if (!this.depotForm.nom.trim()) {
        this.presentToast('Sélectionnez un client ou saisissez un nom', 'danger'); return;
      }
      if (!this.depotForm.numero.trim()) {
        this.presentToast('Le numéro de téléphone est obligatoire', 'danger'); return;
      }
      payload = { nom: this.depotForm.nom, prenom: this.depotForm.prenom, numero: this.depotForm.numero, montant: this.depotForm.montant, observation: this.depotForm.observation };
    }
    const request = this.depotForm.id
      ? this.depotGardeService.modifier(this.depotForm.id, payload)
      : this.depotGardeService.creer(payload);
    request.subscribe({
      next: () => this.afterAction(this.depotForm.id ? 'Dépôt modifié' : 'Dépôt enregistré'),
      error: error => this.presentToast(error?.error?.message || error.message || 'Enregistrement impossible', 'danger')
    });
  }

  openDepotRetrait(depot: DepotGarde): void {
    this.selectedDepot = depot;
    this.retraitDepotForm = { montant: 0, observation: '' };
    this.showDepotRetraitModal = true;
  }

  saveDepotRetrait(): void {
    if (!this.selectedDepot) return;
    if (!this.retraitDepotForm.montant || this.retraitDepotForm.montant <= 0) {
      this.presentToast('Le montant doit être supérieur à 0', 'danger'); return;
    }
    if (this.retraitDepotForm.montant > this.selectedDepot.montantRestant) {
      this.presentToast(`Montant supérieur au solde (${this.depotGardeService.formatMontant(this.selectedDepot.montantRestant)})`, 'danger'); return;
    }
    this.depotGardeService.effectuerRetrait(this.selectedDepot.id, this.retraitDepotForm).subscribe({
      next: () => {
        this.showDepotRetraitModal = false;
        this.afterAction('Retrait enregistré');
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Retrait impossible', 'danger')
    });
  }

  openDepotDetail(depot: DepotGarde): void {
    this.depotGardeService.getById(depot.id).subscribe({
      next: d => { this.depotDetail = d; this.showDepotDetailModal = true; },
      error: error => this.presentToast(error?.error?.message || error.message || 'Chargement impossible', 'danger')
    });
  }

  async confirmCloturerDepot(depot: DepotGarde): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Clôturer ce dépôt ?',
      message: `${depot.nomComplet} — Solde restant : ${this.depotGardeService.formatMontant(depot.montantRestant)}`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Clôturer',
          cssClass: 'alert-btn-danger',
          handler: () => this.depotGardeService.cloturer(depot.id).subscribe({
            next: () => this.afterAction('Dépôt clôturé'),
            error: error => this.presentToast(error?.error?.message || error.message || 'Clôture impossible', 'danger')
          })
        }
      ]
    });
    await alert.present();
  }

  formatDepotMontant(m: number): string {
    return this.depotGardeService.formatMontant(m);
  }

  getPourcentageRetire(depot: DepotGarde): number {
    if (!depot.montantInitial) return 0;
    return Math.round((depot.montantRetire / depot.montantInitial) * 100);
  }

  private resetForms(): void {
    this.factureForm = { id: 0, clientId: undefined, clientNom: '', clientPrenom: '', clientTelephone: '', clientAdresse: '', notes: '' };
    this.factureLines = [];
    this.factureLigneEnCours = { produitId: undefined, designation: '', quantite: 1, prixUnitaire: 0, remisePourcentage: 0, modeLibre: false };
    this.compteForm.id = 0;
    this.detteForm.id = 0;
    this.employeForm.id = 0;
    this.fournisseurForm.id = 0;
    this.userForm.id = 0;
    this.depotForm = { id: 0, depotClientId: undefined, nom: '', prenom: '', numero: '', montant: 0, observation: '' };
    this.selectedDepotClient = undefined;
    this.depotClientSearch = '';
    this.filteredDepotClients = [];
    this.showNewDepotClientForm = false;
    this.depotClientForm = { nom: '', prenom: '', numero: '' };
    this.objectifForm = { fournisseurId: 0, mois: new Date().getMonth() + 1, annee: new Date().getFullYear(), objectifQuantite: 0, bonusParUnite: 0, quantiteAtteinte: 0, quantiteBonusRecue: 0 };
  }

  private afterAction(message: string): void {
    this.presentToast(message);
    this.showForm = false;
    this.load();
  }

  private async confirmDelete(run: () => void): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmer la suppression',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: run }
      ]
    });
    await alert.present();
  }

  private async promptCancelPaiement(paiement: PaiementEmploye): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Annuler le paiement',
      inputs: [{ name: 'motif', type: 'textarea', placeholder: 'Motif' }],
      buttons: [
        { text: 'Fermer', role: 'cancel' },
        {
          text: 'Annuler',
          role: 'destructive',
          handler: data => this.paiementEmployeService.annuler(paiement.id, data.motif || 'Annulation mobile', this.auth.getUserId())
            .subscribe({ next: () => this.afterAction('Paiement annulé'), error: error => this.presentToast(error?.error?.message || error.message || 'Annulation impossible', 'danger') })
        }
      ]
    });
    await alert.present();
  }

  // ==================== FOURNISSEURS ACTIONS ====================

  openAchatForFournisseur(fournisseur: Fournisseur): void {
    this.selectedFournisseur = fournisseur;
    this.achatForm = { fournisseurId: fournisseur.id, produitId: 0, quantite: 1, prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' };
    this.showAchatModal = true;
  }

  openPaiementForFournisseur(fournisseur: Fournisseur): void {
    this.selectedFournisseur = fournisseur;
    this.paiementFournisseur = { fournisseurId: fournisseur.id, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
    this.showPaiementModal = true;
  }

  editFournisseurModal(fournisseur: Fournisseur): void {
    this.selected = fournisseur;
    this.fournisseurForm = { id: fournisseur.id, nom: fournisseur.nom || '', code: fournisseur.code || '', adresse: fournisseur.adresse || '', telephone: fournisseur.telephone || '', email: fournisseur.email || '', description: fournisseur.description || '', actif: fournisseur.actif !== false };
    this.showFournisseurFormModal = true;
  }

  openNewFournisseur(): void {
    this.selected = undefined;
    this.fournisseurForm = { id: 0, nom: '', code: '', adresse: '', telephone: '', email: '', description: '', actif: true };
    this.showFournisseurFormModal = true;
  }

  saveFournisseurModal(): void {
    if (!this.fournisseurForm.nom.trim()) {
      this.presentToast('Le nom du fournisseur est obligatoire', 'danger'); return;
    }
    if (!this.fournisseurForm.code.trim()) {
      this.presentToast('Le code du fournisseur est obligatoire (ex: FOUR-001)', 'danger'); return;
    }
    const { id, ...payload } = this.fournisseurForm;
    const request = id
      ? this.productService.updateFournisseur(id, payload)
      : this.productService.createFournisseur(payload);
    request.subscribe({
      next: () => {
        this.presentToast('Fournisseur enregistré ✓');
        this.showFournisseurFormModal = false;
        this.load();
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Enregistrement impossible', 'danger')
    });
  }

  saveAchatModal(): void {
    if (!this.achatForm.fournisseurId) {
      this.presentToast('Sélectionnez un fournisseur', 'danger'); return;
    }
    if (!this.achatForm.produitId) {
      this.presentToast('Sélectionnez un produit', 'danger'); return;
    }
    if (!this.achatForm.quantite || this.achatForm.quantite <= 0) {
      this.presentToast('Quantité invalide', 'danger'); return;
    }
    if (!this.achatForm.prixAchatUnitaire || this.achatForm.prixAchatUnitaire <= 0) {
      this.presentToast('Prix achat invalide', 'danger'); return;
    }
    this.productService.creerAchat({
      fournisseurId: this.achatForm.fournisseurId,
      lignes: [{ produitId: this.achatForm.produitId, quantite: this.achatForm.quantite, prixAchatUnitaire: this.achatForm.prixAchatUnitaire, prixVente: this.achatForm.prixVente }],
      montantPaye: this.achatForm.montantPaye,
      utilisateurId: this.auth.getUserId()
    }).subscribe({
      next: () => {
        this.presentToast('Achat enregistré ✓');
        this.showAchatModal = false;
        this.loadFournisseurDetails(this.achatForm.fournisseurId);
        this.load();
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Achat impossible', 'danger')
    });
  }

  savePaiementModal(): void {
    this.productService.payerFournisseur({ ...this.paiementFournisseur, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.presentToast('Paiement enregistré ✓');
        this.showPaiementModal = false;
        this.load();
      },
      error: error => this.presentToast(error?.error?.message || error.message || 'Paiement impossible', 'danger')
    });
  }

  async confirmDeleteFournisseur(fournisseur: Fournisseur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Supprimer le fournisseur',
      message: `<strong>${fournisseur.nom}</strong> sera supprimé définitivement.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.productService.deleteFournisseur(fournisseur.id).subscribe({
              next: () => { this.presentToast('Fournisseur supprimé'); this.load(); },
              error: e => this.presentToast(e.message || 'Suppression impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  getFournisseurInitiale(nom: string): string {
    return (nom || '?')[0].toUpperCase();
  }

  getInitiales(nom: string): string {
    return (nom || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  }

  private toDateInput(value?: string): string {
    return value ? new Date(value).toISOString().split('T')[0] : '';
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
