# 📋 Checklist Optimisation Backend - Mode Offline

## 1️⃣ Fichiers à Modifier (Java)

### Fichier: `boutique/src/main/java/com/ges/boutique/vente/Vente.java`

**Changement 1: Ligne 34 - Vendeur en LAZY**
```java
// AVANT
@ManyToOne(fetch = FetchType.EAGER)
@JoinColumn(name = "vendeur_id", nullable = false)
private Utilisateur vendeur;

// APRÈS
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "vendeur_id", nullable = false)
private Utilisateur vendeur;
```

**Changement 2: Ligne 38 - Client en LAZY**
```java
// AVANT
@ManyToOne(fetch = FetchType.EAGER)
@JoinColumn(name = "client_id")
private Client client;

// APRÈS
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "client_id")
private Client client;
```

**Changement 3: Ligne 42 - Lignes en LAZY**
```java
// AVANT
@OneToMany(mappedBy = "vente", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
@JsonManagedReference
private List<LigneVente> lignes = new ArrayList<>();

// APRÈS
@OneToMany(mappedBy = "vente", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
@JsonManagedReference
private List<LigneVente> lignes = new ArrayList<>();
```

**Changement 4: Ajouter colonne clientRequestId (ligne ~120)**
```java
// Ajouter après la colonne utilisateurAnnulation
@Column(name = "client_request_id", unique = true, nullable = true)
private String clientRequestId;

// Getter/Setter (ou Lombok @Data le fait auto)
public String getClientRequestId() {
    return clientRequestId;
}

public void setClientRequestId(String clientRequestId) {
    this.clientRequestId = clientRequestId;
}
```

### Fichier: `boutique/src/main/java/com/ges/boutique/vente/VenteRepository.java`

**Ajouter des méthodes de recherche optimisées:**
```java
// Ajouter après les méthodes existantes

@Query("SELECT v FROM Vente v LEFT JOIN FETCH v.lignes WHERE v.id = :id")
Optional<Vente> findByIdWithLignes(@Param("id") Long id);

@Query("SELECT v FROM Vente v LEFT JOIN FETCH v.vendeur WHERE v.id = :id")
Optional<Vente> findByIdWithVendeur(@Param("id") Long id);

// Pour la déduplication offline
@Query("SELECT v FROM Vente v WHERE v.clientRequestId = :clientRequestId")
Optional<Vente> findByClientRequestId(@Param("clientRequestId") String clientRequestId);

// Pour récupérer toutes les ventes en pagination
@Query("SELECT v FROM Vente v WHERE v.dateVente >= :dateDebut ORDER BY v.dateVente DESC")
Page<Vente> findByDateVente(@Param("dateDebut") LocalDateTime dateDebut, Pageable pageable);
```

### Fichier: `boutique/src/main/java/com/ges/boutique/vente/VenteController.java`

**Changement: Ajouter support clientRequestId dans POST:**
```java
// Ligne 37 - Modifier creerVente pour accepter header
@PostMapping
@PreAuthorize("hasAnyRole('ADMIN', 'VENDEUR')")
@Operation(summary = "Créer une vente (comptant)")
public ResponseEntity<Map<String, Object>> creerVente(
    @RequestBody VenteRequest request,
    @RequestHeader(value = "X-Client-Request-ID", required = false) String clientRequestId
) {
    // Vérifier doublon
    if (clientRequestId != null && !clientRequestId.isEmpty()) {
        Optional<Vente> existing = venteService.findByClientRequestId(clientRequestId);
        if (existing.isPresent()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Vente déjà créée");
            response.put("vente", venteMapper.toVenteMap(existing.get()));
            return ResponseEntity.ok(response);
        }
    }
    
    Vente vente = venteService.creerVente(request, clientRequestId);
    Map<String, Object> response = new HashMap<>();
    response.put("success", true);
    response.put("message", "Vente créée avec succès");
    response.put("vente", venteMapper.toVenteMap(vente));
    return ResponseEntity.ok(response);
}

// Idem pour creerVenteCredit (ligne ~46)
```

### Fichier: `boutique/src/main/java/com/ges/boutique/vente/VenteServiceImpl.java`

**Changement 1: Modifier signature creerVente**
```java
// AVANT
@Override
@Transactional
public Vente creerVente(VenteRequest request) {

// APRÈS
@Override
@Transactional
public Vente creerVente(VenteRequest request, String clientRequestId) {
    // Ajouter la ligne après log.info
    if (clientRequestId != null) {
        vente.setClientRequestId(clientRequestId);
    }
```

**Changement 2: Ajouter méthode findByClientRequestId**
```java
@Override
public Optional<Vente> findByClientRequestId(String clientRequestId) {
    return venteRepository.findByClientRequestId(clientRequestId);
}
```

---

## 2️⃣ Fichiers à Modifier (Configuration)

### Fichier: `boutique/src/main/resources/application.properties`

**Changement 1: Ligne 22 - Pool size**
```properties
# AVANT
spring.datasource.hikari.maximum-pool-size=10

# APRÈS
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
```

**Changement 2: Ligne 28-29 - Show SQL**
```properties
# AVANT
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# APRÈS
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=false
```

**Changement 3: Lignes 45-49 - Logging**
```properties
# AVANT
logging.level.com.ges.boutique=DEBUG
logging.level.org.springframework.security=DEBUG
logging.level.org.springframework.web=DEBUG
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE

# APRÈS
logging.level.com.ges.boutique=INFO
logging.level.org.springframework.security=WARN
logging.level.org.springframework.web=WARN
logging.level.org.hibernate.SQL=WARN
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=WARN
```

**Changement 4: Ajouter caching (à la fin du fichier)**
```properties
# ====================================
# CACHING
# ====================================
spring.cache.type=simple
spring.cache.cache-names=ventes,clients,utilisateurs

# Optional: Redis (si disponible)
# spring.cache.type=redis
# spring.redis.host=localhost
# spring.redis.port=6379
```

---

## 3️⃣ Scripts SQL à Exécuter

```bash
# Exécuter dans MySQL (depuis le dossier backend)
mysql -u root -p alimentation < ../BACKEND_MIGRATION_SQL.md

# Ou manuellement copier les commandes du fichier BACKEND_MIGRATION_SQL.md
```

---

## 4️⃣ Vérification Post-Modification

### Build et Test
```bash
cd boutique

# 1. Clean build
mvn clean install

# 2. Vérifier compilation
mvn compile

# 3. Tester
mvn test

# 4. Run
mvn spring-boot:run
```

### Test curl offline
```bash
# Créer vente 1 (sans id)
curl -X POST http://localhost:8080/api/ventes \
  -H "Content-Type: application/json" \
  -d '{
    "vendeurId": 1,
    "lignes": [{"produitId": 1, "quantite": 1, "prixUnitaire": 1000}],
    "modePaiement": "ESPECES"
  }'

# Réponse 1: {"success": true, "vente": {..., "id": 1}}

# Créer vente 2 (même id)
curl -X POST http://localhost:8080/api/ventes \
  -H "Content-Type: application/json" \
  -H "X-Client-Request-ID: uuid-test-123" \
  -d '{...}'

# Réponse 2: {"success": true, "vente": {..., "id": 2}}

# Retry avec même id (doit retourner vente 2)
curl -X POST http://localhost:8080/api/ventes \
  -H "Content-Type: application/json" \
  -H "X-Client-Request-ID: uuid-test-123" \
  -d '{...}'

# Réponse 3: {"success": true, "vente": {..., "id": 2}} ← MÊME ID
```

---

## ⏱️ Temps Estimation

| Tâche | Temps |
|-------|-------|
| Modifier Vente.java (4 changements) | 10 min |
| Modifier VenteRepository.java (4 méthodes) | 10 min |
| Modifier VenteController.java (2 endpoints) | 10 min |
| Modifier VenteServiceImpl.java (2 changements) | 10 min |
| Modifier application.properties (4 sections) | 5 min |
| Exécuter migrations SQL | 5 min |
| Build & test | 10 min |
| **TOTAL** | **~60 minutes** |

---

## ✅ Checklist Finale

- [ ] Vente.java: EAGER → LAZY pour vendeur, client, lignes
- [ ] Vente.java: Ajouter colonne clientRequestId
- [ ] VenteRepository.java: Ajouter 4 méthodes fetch optimisées
- [ ] VenteRepository.java: Ajouter findByClientRequestId()
- [ ] VenteController.java: Ajouter X-Client-Request-ID header
- [ ] VenteServiceImpl.java: Supporter clientRequestId
- [ ] application.properties: Pool 20, logging WARN, show-sql false
- [ ] Exécuter migrations SQL
- [ ] Build réussit (mvn clean install)
- [ ] Tests passent
- [ ] Tester offline avec curl
- [ ] ✅ Ready for offline mode

---

## 🚀 Prochaine Étape

Une fois ces modifications faites côté backend:
1. Committer les changements
2. Déployer sur test
3. Tester 50+ ventes offline en parallèle
4. Vérifier pas de timeout
5. Vérifier pas de doublons
6. ✅ Offline mode validated
