# Mode Offline - Implémentation Complète

## 📋 Résumé des Modifications

### Dépendances Installées
- ✅ `@capacitor/network@8` - Détection de connexion réseau
- ✅ `@ionic/storage-angular@4` (existant) - Stockage local sécurisé
- ✅ `uuid@latest` - Génération d'identifiants uniques pour les requêtes

### Services Créés

#### 1. `OfflineQueueService` (`offline-queue.service.ts`)
- Gère la file d'attente locale des actions
- Persiste dans Ionic Storage
- Permet d'ajouter, mettre à jour et supprimer des actions

#### 2. `NetworkStatusService` (`network-status.service.ts`)
- Détecte l'état de la connexion via Capacitor Network
- Émet les changements de statut
- Fallback pour les tests web

#### 3. `OfflineSyncService` (`offline-sync.service.ts`)
- Orchestre la synchronisation automatique
- Écoute les changements de connexion
- Lance la sync quand Internet revient
- Gère les retries (max 3 tentatives)

#### 4. `OfflineVenteService` (`offline-vente.service.ts`)
- Wrapper autour de VenteService
- Enregistre les ventes en offline si pas de connexion
- Wrapper complet de toutes les méthodes VenteService

#### 5. `ClientRequestIdInterceptor` (`client-request-id.interceptor.ts`)
- Ajoute le header `X-Client-Request-ID` à toutes les requêtes de vente
- Évite les doublons côté backend

### Composant UI

#### `OfflineStatusComponent` (`components/offline-status/`)
- Affiche le statut de connexion
- Montre la file d'attente
- Permet de forcer la synchronisation
- S'affiche automatiquement quand hors ligne

### Modifications app.module.ts
- Intégration de `IonicStorageModule`
- Enregistrement de `ClientRequestIdInterceptor`
- Import du composant `OfflineStatusComponent`

### Modifications app.component.html
- Ajout du composant `<app-offline-status>` à la fin

## 🚀 Utilisation

### 1. Remplacer VenteService par OfflineVenteService

Avant :
```typescript
constructor(private venteService: VenteService) {}
```

Après :
```typescript
constructor(private offlineVenteService: OfflineVenteService) {}
```

Utilisation : La même interface, mais gère automatiquement l'offline.

### 2. Test en Mode Web

```bash
# Terminal 1 - Build
npm start

# Terminal 2 - Chrome DevTools
# F12 → Network tab → Throttling → Offline
```

### 3. Test en Mode Mobile

```bash
# Build Android
ionic build --prod
ionic capacitor build android

# Ou activez le mode Avion sur le téléphone
```

## 📊 Flux de Synchronisation

```
Créer vente
    ↓
Réseau OK?
    ├─ OUI → Envoyer direct au backend
    └─ NON → Enregistrer localement
                 ↓
                Afficher notification
                 ↓
            Utilisateur reconnecté
                 ↓
            Sync automatique démarre
                 ↓
            Envoyer chaque action avec X-Client-Request-ID
                 ↓
            Backend détecte les doublons (par clientRequestId)
                 ↓
            Backend retourne vente existante
                 ↓
            Supprimer action de la queue
                 ↓
            Notification "Sync terminée"
```

## 🔧 Configuration Backend (Spring Boot)

### Étapes à faire côté backend

1. Ajouter colonne `client_request_id` à l'entité Vente
2. Ajouter index sur cette colonne
3. Modifier VenteController pour accepter `X-Client-Request-ID`
4. Vérifier avant chaque création si `clientRequestId` existe déjà
5. Si existe : retourner la vente existante
6. Si n'existe pas : créer et affecter le `clientRequestId`

**Voir `OFFLINE_BACKEND_INTEGRATION.md` pour les détails complets**

## 🧪 Scenarios de Test

### Scénario 1 : Création en ligne
1. Activer Internet
2. Créer une vente
3. ✅ Vente créée avec numéro réel

### Scénario 2 : Création hors ligne
1. Désactiver Internet (ou mode Offline Chrome)
2. Créer une vente
3. ✅ Vente enregistrée localement avec ID "OFFLINE-xxx"
4. ✅ Notif d'offline
5. ✅ Carte grise avec icône d'attente

### Scénario 3 : Sync automatique
1. Créer vente en offline
2. Réactiver Internet
3. ✅ Sync automatique démarre
4. ✅ Vente passe à statut "SUCCES"
5. ✅ Vente disparaît de la queue
6. ✅ Notif de sync complète

### Scénario 4 : Doublon
1. Créer vente en offline avec ID "AAA"
2. Sync envoie au backend avec X-Client-Request-ID: AAA
3. Backend reçoit, cherche clientRequestId = AAA
4. ✅ Pas de match, créé vente
5. ✅ Aucun doublon

### Scénario 5 : Retry après erreur
1. Créer vente en offline
2. Sync échoue (ex: stock insuffisant)
3. ✅ Statut passe à "ECHEC"
4. ✅ Message d'erreur affiché
5. Reréessayer plus tard
6. ✅ Jusqu'à 3 tentatives automatiques

## 📱 États Visibles à l'Écran

### Hors ligne
```
[🔴 Mode Hors Ligne]
✓ 3 actions en attente
[Synchroniser Maintenant]
```

### Sync en cours
```
[⏳ Synchronisation en cours...]
Dernière sync: 14:32:15
✓ 1 réussi(es) | ✗ 0 échoué(es)
```

### Erreur
```
[🔴 Mode Hors Ligne]
Type: VENTE | Status: ECHEC
Erreur: Stock insuffisant
[Synchroniser Maintenant]
```

## 🐛 Débogage

### Console du navigateur
```typescript
// Voir la queue
offlineSyncService.getQueueObservable().subscribe(console.log);

// Voir le statut
offlineSyncService.getSyncStatus().subscribe(console.log);

// Voir la connexion
networkStatusService.getNetworkStatus().subscribe(console.log);
```

### Chrome DevTools
- Network tab → Throttling → Offline
- Application tab → Storage → IndexedDB → _ionicstorage
- Console pour les logs (voir console.log dans les services)

## ⚙️ Configuration Fine (Optionnel)

### Délai avant tentative de sync
Modifier dans `offline-sync.service.ts` :
```typescript
delay(1000)  // Actuellement 1 seconde
```

### Max tentatives
Modifier dans `offline-sync.service.ts` :
```typescript
if (action.attemptCount >= 3)  // Actuellement 3
```

### Intervalle de check réseau (fallback)
Modifier dans `network-status.service.ts` :
```typescript
setInterval(() => this.checkConnectivity(), 30000);  // 30 secondes
```

## 📚 Documentation Complète

- `OFFLINE_FRONTEND_GUIDE.md` - Guide complet frontend
- `OFFLINE_BACKEND_INTEGRATION.md` - Intégration backend Spring Boot

## ✅ Checklist Finale

- [x] Dépendances installées
- [x] Services créés et compilent
- [x] Interceptor enregistré
- [x] Composant UI intégré
- [x] app.module.ts mis à jour
- [x] app.component.html mis à jour
- [x] Documentation rédigée
- [ ] Backend implémenté
- [ ] Tests en mobile validés
- [ ] Déploiement production

## 🎉 Ready to Go!

Le mode offline est prêt à être testé. Assurez-vous que le backend a aussi implémenté les modifications avant de tester end-to-end.

Questions ? Consultez les guides ou les commentaires dans le code.
