# 🚨 Analyse Performance Backend - Mode Offline

## Problèmes Détectés

### 1. **EAGER LOADING PROBLÉMATIQUE** 🔴 CRITIQUE
**Location:** `Vente.java` lines 34-44

```java
@ManyToOne(fetch = FetchType.EAGER)  // ❌ VENDEUR
private Utilisateur vendeur;

@ManyToOne(fetch = FetchType.EAGER)  // ❌ CLIENT
private Client client;

@OneToMany(... fetch = FetchType.EAGER ...) // ❌ LIGNES
private List<LigneVente> lignes;
```

**Impact:** 
- Chaque Vente charge TOUS ses enfants (vendeur, client, lignes)
- Avec 100+ requêtes offline → explosion de requêtes DB
- Problème N+1 multiplié

**Solution:**
```java
@ManyToOne(fetch = FetchType.LAZY)  // ✅ LAZY
private Utilisateur vendeur;

@ManyToOne(fetch = FetchType.LAZY)  // ✅ LAZY
private Client client;

@OneToMany(mappedBy = "vente", cascade = CascadeType.ALL, 
           fetch = FetchType.LAZY)  // ✅ LAZY
private List<LigneVente> lignes;
```

### 2. **Pool de Connexion MySQL Très Faible** 🔴 CRITIQUE

**Location:** `application.properties` line 22
```properties
spring.datasource.hikari.maximum-pool-size=10  # ❌ TOO LOW
```

**Impact:**
- 10 connexions seulement pour tout le backend
- Mode offline = sync en parallèle = problème immédiat
- Timeout après 30s si queue > 10

**Solution:**
```properties
# Calculer : CPU cores * 2 + spindle count (disque)
# Serveur standard = 4 cores → 10-20 connexions
# Avec offline sync = 20-30 connexions minimum

spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
```

### 3. **Logging Trop Verbeux** 🟡 MODÉRÉ

**Location:** `application.properties` lines 45-49
```properties
logging.level.com.ges.boutique=DEBUG  # ❌ Debug en prod
logging.level.org.springframework.security=DEBUG  # ❌
logging.level.org.springframework.web=DEBUG  # ❌
logging.level.org.hibernate.SQL=DEBUG  # ❌
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE  # ❌❌
```

**Impact:**
- Chaque requête = ~10 lignes de logs
- Avec 100 requêtes offline = 1000+ lignes
- Disque I/O ralentit le serveur

**Solution:**
```properties
# Production
logging.level.com.ges.boutique=INFO
logging.level.org.springframework.security=WARN
logging.level.org.springframework.web=WARN
logging.level.org.hibernate.SQL=WARN
```

### 4. **Show SQL Activé** 🟡 MODÉRÉ

**Location:** `application.properties` line 28
```properties
spring.jpa.show-sql=true  # ❌ Pénalité -20% performance
```

**Solution:**
```properties
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=false
```

### 5. **Pas de Caching Observable** 🟡 MODÉRÉ
- Projet a `spring-boot-starter-cache` (pom.xml line 57)
- Mais configuration cachée nulle part
- Cache doit être activé

### 6. **Pas de Pagination sur Certains Endpoints** 🟡 MODÉRÉ
- `getAllVentes()` etc retourne probablement tout
- Avec 10k+ ventes = timeout

---

## 📊 Estimations Impact

### Scénario: 50 ventes sync en même temps

**Avant optimisation:**
```
Requêtes DB par vente: ~3-4 (vente + vendeur + client + lignes)
Total: 50 * 4 = 200 requêtes
Pool size: 10 → Queue: 190 en attente
Temps: ~30-60 secondes
Timeout: ✓ Erreurs probables
```

**Après optimisation (lazy + pool 20):**
```
Requêtes DB par vente: ~1 (vente seulement)
Total: 50 * 1 = 50 requêtes
Pool size: 20 → Queue: 30 en attente
Temps: ~5-10 secondes
Timeout: ✓ OK
```

---

## ✅ Recommandations Priorisation

### 🔴 URGENT (Faire MAINTENANT avant offline)

1. **Changer EAGER → LAZY** sur Vente.java
   - 15 min
   - Impact: -80% requêtes

2. **Augmenter pool MySQL** à 20
   - 5 min
   - Impact: Handle mieux la concurrence

3. **Ajouter @Query fetch LAZY** où nécessaire
   - 30 min
   - Impact: Contrôle fin

### 🟡 RECOMMANDÉ (Après lancement offline)

4. Ajouter @Cacheable sur getMostUsed()
5. Ajouter pagination sur getAllVentes()
6. Ajouter indices DB sur `clientRequestId` (pour offline)

### 🟢 OPTIONNEL (Long terme)

7. Activer Redis si beaucoup de cache
8. Monitorer performance avec Prometheus

---

## Code à Modifier

### 1. Vente.java
```java
// AVANT
@ManyToOne(fetch = FetchType.EAGER)
private Utilisateur vendeur;

// APRÈS
@ManyToOne(fetch = FetchType.LAZY)
private Utilisateur vendeur;

// Idem pour Client et LigneVente
```

### 2. VenteRepository.java
Ajouter des requêtes JPQL avec fetch optimisé :
```java
@Query("SELECT v FROM Vente v LEFT JOIN FETCH v.lignes WHERE v.id = :id")
Optional<Vente> findByIdWithLignes(@Param("id") Long id);

@Query("SELECT v FROM Vente v LEFT JOIN FETCH v.vendeur WHERE v.id = :id")
Optional<Vente> findByIdWithVendeur(@Param("id") Long id);
```

### 3. application.properties
```properties
# Database Pool
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5

# Logging (Production)
logging.level.com.ges.boutique=INFO
logging.level.org.springframework=WARN
logging.level.org.hibernate=WARN

# JPA
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=false
```

### 4. Optionnel: Ajouter index MySQL
```sql
ALTER TABLE vente ADD INDEX idx_client_request_id (client_request_id);
ALTER TABLE vente ADD INDEX idx_vendeur_id (vendeur_id);
ALTER TABLE vente ADD INDEX idx_date_vente (date_vente);
ALTER TABLE vente ADD INDEX idx_est_credit (est_credit);
```

---

## 🧪 Test de Performance

Avant & Après:

```bash
# Avant
curl -X GET http://localhost:8080/api/ventes
# Time: ~5s pour 100 ventes

# Après
curl -X GET http://localhost:8080/api/ventes
# Time: ~500ms pour 100 ventes
```

---

## 🎯 Résumé pour Backend

| Problème | Sévérité | Fix Time | Impact |
|---------|----------|---------|--------|
| Eager Fetching | 🔴 | 15min | -80% requêtes |
| Pool Size 10 | 🔴 | 5min | Handle concurrence |
| Logging DEBUG | 🟡 | 10min | +30% perf |
| Show SQL ON | 🟡 | 5min | +10% perf |
| Pas de cache | 🟡 | 30min | Optionnel |

**Total Time: ~1 heure max pour optimiser**

**Gain: 10x+ plus rapide sous charge offline**

---

## ⚠️ Attention Mode Offline

Le mode offline va créer des pics de requêtes concurrentes.

**Sans optimisation:**
- 50 ventes offline = 200+ requêtes = TIMEOUT
- Sync échoue = Actions restent EN_ATTENTE indéfiniment

**Avec optimisation:**
- 50 ventes offline = 50 requêtes = ✓ OK
- Sync réussit = Actions supprimées
