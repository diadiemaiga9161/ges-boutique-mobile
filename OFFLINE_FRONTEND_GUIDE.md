# Mode Offline - Guide d'Utilisation Frontend

## Architecture

### Services Créés

1. **OfflineQueueService** (`offline-queue.service.ts`)
   - Gère la file d'attente locale des actions
   - Persiste les actions dans Ionic Storage
   - Émet les changements via RxJS Observables

2. **NetworkStatusService** (`network-status.service.ts`)
   - Détecte l'état de la connexion via Capacitor Network
   - Émet les changements de statut réseau
   - Fallback sur vérification HTTP pour les tests web

3. **OfflineSyncService** (`offline-sync.service.ts`)
   - Orchestre la synchronisation des actions
   - Écoute les changements de connexion
   - Lance automatiquement la synchronisation

4. **OfflineVenteService** (`offline-vente.service.ts`)
   - Wrapper autour de VenteService
   - Intercepte les erreurs réseau
   - Enregistre les ventes en local quand hors ligne

5. **ClientRequestIdInterceptor** (`client-request-id.interceptor.ts`)
   - Ajoute le header X-Client-Request-ID à toutes les requêtes
   - Évite les doublons côté backend

## Utilisation dans les Composants

### 1. Créer une Vente Hors Ligne

```typescript
import { Component } from '@angular/core';
import { OfflineVenteService } from 'src/app/services/offline-vente.service';
import { OfflineSyncService } from 'src/app/services/offline-sync.service';

@Component({
  selector: 'app-vente',
  templateUrl: './vente.page.html',
  styleUrls: ['./vente.page.scss']
})
export class VentePage {
  constructor(
    private offlineVenteService: OfflineVenteService,
    private offlineSyncService: OfflineSyncService
  ) {}

  createVente(): void {
    const vente = {
      vendeurId: 1,
      lignes: [{
        produitId: 1,
        quantite: 2,
        prixUnitaire: 1000
      }],
      modePaiement: 'ESPECES'
    };

    this.offlineVenteService.createVente(vente).subscribe(
      (response) => {
        console.log('Vente créée:', response);
        // Si hors ligne: numeroVente sera 'OFFLINE-xxx'
        // Si en ligne: numeroVente sera numéro réel
      },
      (error) => {
        console.error('Erreur lors de la création:', error);
      }
    );
  }
}
```

### 2. Afficher le Statut de Connexion

```html
<div [ngClass]="{'online': (isOnline$ | async), 'offline': !(isOnline$ | async)}">
  <span *ngIf="isOnline$ | async">🟢 En ligne</span>
  <span *ngIf="!(isOnline$ | async)">🔴 Hors ligne</span>
</div>

<div *ngIf="(syncStatus$ | async) as status">
  <span *ngIf="status.isSyncing">⏳ Synchronisation en cours...</span>
  <span *ngIf="!status.isSyncing && status.syncedCount > 0">
    ✓ {{ status.syncedCount }} actions synchronisées
  </span>
</div>
```

### 3. Afficher la Queue Offline

```typescript
export class QueuePage {
  offlineQueue$: Observable<OfflineAction[]>;

  constructor(private offlineSyncService: OfflineSyncService) {
    this.offlineQueue$ = this.offlineSyncService.getQueueObservable();
  }

  forceSync(): void {
    this.offlineSyncService.syncPendingActions();
  }
}
```

```html
<ion-list>
  <ion-item *ngFor="let action of (offlineQueue$ | async)">
    <ion-label>
      <h3>{{ action.type }}</h3>
      <p>Statut: {{ action.status }}</p>
      <p *ngIf="action.lastError">Erreur: {{ action.lastError }}</p>
    </ion-label>
    <ion-badge [color]="getStatusColor(action.status)">
      {{ action.status }}
    </ion-badge>
  </ion-item>
</ion-list>

<ion-button (click)="forceSync()" expand="block">
  Synchroniser Maintenant
</ion-button>
```

## Flux de Synchronisation

```
┌─────────────────────────────────────┐
│  Utilisateur crée une vente         │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌─────────────┐
        │  Réseau OK? │
        └────┬────┬───┘
       Non   │    │   Oui
             │    │
             ▼    ▼
         Offline Online
             │    │
             ▼    ▼
      Enqueue   Send
      Local     Direct
             │    │
             └────┴─────┬──────┘
                        │
                   ┌────▼────┐
                   │  Succès? │
                   └────┬────┬─┘
                    Non │    │ Oui
                        ▼    ▼
                      Retry Saved
                        
        Réseau revient
             │
             ▼
      Sync Queue
      Une par une
             │
             ▼
      Succès? Enqueue/Reject
```

## États des Actions Offline

- **EN_ATTENTE** : Action enregistrée, en attente de synchronisation
- **EN_COURS** : Action en cours d'envoi
- **SUCCES** : Action envoyée avec succès
- **ECHEC** : Erreur lors de l'envoi (max 3 tentatives)

## Configuration du App Module

L'intégration est déjà faite dans `app.module.ts` :

```typescript
imports: [
  IonicStorageModule.forRoot()  // Pour le stockage local
],
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: ClientRequestIdInterceptor, multi: true }
]
```

## Comportement Attendu

### Scénario 1 : Connexion OK
1. Utilisateur crée une vente
2. Service envoie directement au backend
3. Backend traite et retourne le numéro de vente
4. Affichage normal de la vente

### Scénario 2 : Mode Hors Ligne
1. Utilisateur crée une vente
2. Service détecte pas de connexion
3. Service enregistre localement avec ID temporaire (OFFLINE-xxx)
4. Affichage d'une notification "Vente enregistrée localement"
5. Vente apparaît avec icône "⏳ En attente de synchronisation"

### Scénario 3 : Reconnexion
1. Utilisateur se reconnecte à Internet
2. Service détecte le changement
3. Service commence la synchronisation automatique
4. Chaque action est envoyée avec X-Client-Request-ID
5. Backend détecte les doublons et retourne les ventes existantes
6. Actions supprimées de la file locale
7. Notification de synchronisation complète

### Scénario 4 : Erreur de Synchronisation
1. Service tente d'envoyer
2. Backend retourne erreur (stock insuffisant, etc.)
3. Service met à jour le statut à ECHEC
4. Affichage du message d'erreur
5. Retry automatique (max 3 tentatives)

## Tests

### Test Offline (Mode Web)
Ouvrir Chrome DevTools → Network → Throttling → Offline

### Test Offline (Mobile)
Activer le mode Avion ou désactiver le WiFi

### Test de Reconnexion
1. Créer une vente en mode offline
2. Réactiver la connexion
3. Vérifier que la vente est synchronisée

### Test de Doublon
1. Créer une vente en offline avec clientRequestId X
2. Simuler un timeout après envoi
3. Relancer la synchronisation
4. Backend ne crée pas de doublon (recherche par clientRequestId)

## Considérations de Performance

- La queue est limitée à 1000 actions max (à configurer)
- Les tentatives de synchronisation sont espacées de 5 secondes minimum
- Chaque action peut être retentée max 3 fois
- Les actions réussies sont supprimées après 24 heures

## Débogage

```typescript
// Afficher la queue dans la console
offlineSyncService.getQueueObservable().subscribe(queue => {
  console.log('Queue actuelle:', queue);
});

// Afficher le statut de synchronisation
offlineSyncService.getSyncStatus().subscribe(status => {
  console.log('Statut sync:', status);
});

// Afficher le statut réseau
networkStatusService.getNetworkStatus().subscribe(status => {
  console.log('Statut réseau:', status);
});
```
