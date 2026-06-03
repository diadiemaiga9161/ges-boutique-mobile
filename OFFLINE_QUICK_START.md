# Aide Rapide - Mode Offline

## Installation ✅

```bash
npm install @capacitor/network@8
npm install uuid@latest
# @ionic/storage-angular était déjà installé
```

## Fichiers Créés

### Services (5 fichiers)
```
src/app/services/
├── offline-queue.service.ts        ← File d'attente locale
├── network-status.service.ts       ← Détection réseau
├── offline-sync.service.ts         ← Orchestration sync
├── offline-vente.service.ts        ← Wrapper VenteService
└── client-request-id.interceptor.ts ← Header unique
```

### Composant UI (4 fichiers)
```
src/app/components/offline-status/
├── offline-status.component.ts     ← Logique
├── offline-status.component.html   ← Affichage
├── offline-status.component.scss   ← Styles
└── offline-status.module.ts        ← Module
```

### Documentation (3 fichiers)
```
root/
├── OFFLINE_IMPLEMENTATION.md       ← Vue d'ensemble
├── OFFLINE_FRONTEND_GUIDE.md       ← Guide détaillé frontend
└── OFFLINE_BACKEND_INTEGRATION.md  ← Intégration backend
```

## Modifications Existantes

- **app.module.ts** : Import IonicStorageModule, ClientRequestIdInterceptor, OfflineStatusModule
- **app.component.html** : Ajout `<app-offline-status></app-offline-status>`

## Utilisation Simple

### 1. Dans un composant
```typescript
constructor(private offlineVenteService: OfflineVenteService) {}

createVente() {
  this.offlineVenteService.createVente(venteData).subscribe(
    response => console.log('OK', response),
    error => console.error('Erreur', error)
  );
}
```

### 2. Monitorer la queue
```typescript
constructor(private offlineSyncService: OfflineSyncService) {}

ngOnInit() {
  this.offlineSyncService.getQueueObservable().subscribe(queue => {
    console.log(`${queue.length} actions en attente`);
  });
}
```

### 3. Forcer la sync
```typescript
this.offlineSyncService.syncPendingActions();
```

## Test Rapide (Chrome Web)

1. **Ouvrir l'app**
   ```bash
   npm start
   ```

2. **Ouvrir DevTools**
   - F12

3. **Passer en offline**
   - Network tab → No throttling → Offline

4. **Créer une vente**
   - Voir la carte grise "Mode Hors Ligne"
   - Voir l'action en queue avec statut EN_ATTENTE

5. **Revenir online**
   - Network tab → No throttling
   - La sync démarre automatiquement

6. **Vérifier la sync**
   - Voir l'action passer à SUCCES
   - Voir la carte disparaître

## Backend - Prochaines Étapes

Le backend doit implémenter :

1. **Ajouter colonne clientRequestId**
   ```sql
   ALTER TABLE vente ADD COLUMN client_request_id VARCHAR(36) UNIQUE;
   ```

2. **Avant de créer une vente**
   ```java
   if (clientRequestId != null) {
     Optional<Vente> existing = repo.findByClientRequestId(clientRequestId);
     if (existing.isPresent()) {
       return existing.get();  // Déjà créée
     }
   }
   ```

3. **Après création, sauver le clientRequestId**
   ```java
   vente.setClientRequestId(clientRequestId);
   venteRepository.save(vente);
   ```

**Voir OFFLINE_BACKEND_INTEGRATION.md pour le code complet**

## Structure des Données

### OfflineAction
```typescript
{
  id: "1234567890-abc123",           // Généré localement
  type: "VENTE",                      // Type d'action
  endpoint: "/ventes",                // URL backend
  method: "POST",                     // HTTP method
  clientRequestId: "uuid-v4",         // Identifiant unique
  status: "EN_ATTENTE",               // EN_ATTENTE | EN_COURS | SUCCES | ECHEC
  createdAt: "2025-06-03T14:00:00Z", // ISO string
  attemptCount: 0,                    // Nombre de tentatives
  data: { /* VenteRequest */ },       // Payload
  lastError: null                     // Message d'erreur si ECHEC
}
```

## Observables Disponibles

```typescript
// 1. État du réseau
networkStatusService.getNetworkStatus()
// → { isOnline: boolean, connectionType: string }

// 2. Statut de sync
offlineSyncService.getSyncStatus()
// → { isSyncing, lastSyncTime, syncedCount, failedCount }

// 3. Queue d'actions
offlineSyncService.getQueueObservable()
// → OfflineAction[]

// 4. Événement de fin de sync
offlineSyncService.getSyncCompleted()
// → { successful, failed }
```

## Logs Utiles

```typescript
// Pour déboguer dans la console
localStorage.setItem('debug:offline', 'true');

// Afficher la queue
JSON.parse(localStorage.getItem('offline_queue') || '[]').forEach(a => {
  console.log(`${a.type} - ${a.status}: ${a.clientRequestId}`);
});
```

## Erreurs Courantes

### "Property 'getItem' does not exist"
❌ Faux : `this.storage.getItem()`
✅ Bon : `this.storage.get()`

### "Header X-Client-Request-ID not added"
Vérifier que ClientRequestIdInterceptor est enregistré dans app.module.ts

### "Storage not initialized"
Vérifier que IonicStorageModule est importé dans app.module.ts

## Performance

- Queue limitée à 1000 actions max
- Tentatives max 3 par action
- Délai avant retry : 1 seconde
- Intervalle check réseau : 30 secondes
- Actions réussies supprimées après sync

## Sécurité

✅ ClientRequestId unique (UUID v4)
✅ Stockage local (Ionic Storage)
✅ Pas de données sensibles en queue
✅ Header X-Client-Request-ID pour éviter les doublons
⚠️ Backend doit valider le header

## Support

Fichiers d'aide :
- `OFFLINE_IMPLEMENTATION.md` - Vue d'ensemble complète
- `OFFLINE_FRONTEND_GUIDE.md` - Guide détaillé avec examples
- `OFFLINE_BACKEND_INTEGRATION.md` - Code backend
- Code source bien commenté

Bon offline ! 🚀
