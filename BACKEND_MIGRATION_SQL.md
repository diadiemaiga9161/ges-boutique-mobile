# Migration SQL - Optimisations Backend pour Mode Offline

## Fichier: V001_optimize_vente_table.sql

```sql
-- ================================================================
-- Migration: Optimiser table ventes pour mode offline
-- Date: 2025-06-03
-- Description: Ajouter colonne clientRequestId, créer indices
-- ================================================================

-- 1. Ajouter colonne client_request_id (pour déduplication offline)
ALTER TABLE ventes ADD COLUMN client_request_id VARCHAR(36) UNIQUE NULL;

-- 2. Créer index pour recherche rapide par clientRequestId
CREATE INDEX idx_vente_client_request_id ON ventes(client_request_id);

-- 3. Optimiser les index existants pour les requêtes fréquentes
CREATE INDEX idx_vente_date_vente ON ventes(date_vente DESC);
CREATE INDEX idx_vente_vendeur_id ON ventes(vendeur_id);
CREATE INDEX idx_vente_client_id ON ventes(client_id);
CREATE INDEX idx_vente_est_credit ON ventes(est_credit);
CREATE INDEX idx_vente_credit_regle ON ventes(credit_regle);

-- 4. Ajouter colonne sync_status pour tracer les offline
ALTER TABLE ventes ADD COLUMN sync_status VARCHAR(20) DEFAULT 'SYNCED';
-- Valeurs: SYNCED, SYNCING, FAILED

-- 5. Ajouter colonne sync_attempt_count
ALTER TABLE ventes ADD COLUMN sync_attempt_count INT DEFAULT 0;

-- 6. Ajouter colonne sync_last_error pour debug
ALTER TABLE ventes ADD COLUMN sync_last_error VARCHAR(500) NULL;

-- 7. Index combiné pour queries fréquentes
CREATE INDEX idx_vente_vendeur_date ON ventes(vendeur_id, date_vente DESC);
CREATE INDEX idx_vente_credit_status ON ventes(est_credit, credit_regle, date_echeance);

-- Optionnel: Partition par année pour très grand volume
-- ALTER TABLE ventes PARTITION BY RANGE (YEAR(date_vente)) (
--     PARTITION p_2024 VALUES LESS THAN (2025),
--     PARTITION p_2025 VALUES LESS THAN (2026),
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );
```

## Fichier: V002_add_request_tracking.sql

```sql
-- ================================================================
-- Migration: Ajouter table de tracking des requêtes offline
-- ================================================================

-- Table pour tracker les tentatives de sync
CREATE TABLE IF NOT EXISTS offline_sync_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_request_id VARCHAR(36) NOT NULL UNIQUE,
    vente_id BIGINT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempt_count INT DEFAULT 1,
    last_error VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    synced_at TIMESTAMP NULL,
    
    FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_client_request_id (client_request_id),
    INDEX idx_created_at (created_at),
    INDEX idx_synced_at (synced_at)
);

-- Table pour archiver les ventes offline synchronisées
CREATE TABLE IF NOT EXISTS vente_offline_archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    original_vente_id BIGINT NOT NULL,
    client_request_id VARCHAR(36) NOT NULL UNIQUE,
    sync_duration_ms BIGINT,
    error_count INT,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_client_request_id (client_request_id),
    INDEX idx_synced_at (synced_at)
);
```

## Fichier: V003_optimize_hibernate_settings.sql

```sql
-- ================================================================
-- Migration: Statistiques DB pour optimizer
-- ================================================================

-- Analyser table pour optimiser query plans
ANALYZE TABLE ventes;
ANALYZE TABLE vente_offline_sync_log;
ANALYZE TABLE utilisateurs;
ANALYZE TABLE clients;
ANALYZE TABLE ligne_ventes;

-- Vérifier fragmentation
SELECT TABLE_NAME, 
       ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS SIZE_MB,
       ROUND((DATA_FREE / 1024 / 1024), 2) AS FREE_MB
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'alimentation' 
ORDER BY SIZE_MB DESC;

-- Si fragmentation > 10%, faire OPTIMIZE
-- OPTIMIZE TABLE ventes;
-- OPTIMIZE TABLE ligne_ventes;
```

## Fichier: V004_connection_pool_optimization.sql

```sql
-- ================================================================
-- Vérifier que la DB peut supporter la charge
-- ================================================================

-- Montrer les connexions actuelles
SHOW PROCESSLIST;

-- Montrer les max connections
SHOW VARIABLES LIKE 'max_connections';

-- Recommandé pour mode offline (à exécuter dans my.cnf ou docker):
-- max_connections=100
-- max_allowed_packet=256M
-- innodb_buffer_pool_size=1GB

-- Vérifier les slow queries
SELECT COUNT(*) FROM mysql.slow_log WHERE start_time > NOW() - INTERVAL 1 HOUR;

-- Montrer requêtes longues
SELECT * FROM mysql.slow_log 
WHERE start_time > NOW() - INTERVAL 1 HOUR
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 📋 Ordre d'Exécution

1. **Avant lancement offline:**
   ```bash
   mysql alimentation < V001_optimize_vente_table.sql
   mysql alimentation < V002_add_request_tracking.sql
   mysql alimentation < V003_optimize_hibernate_settings.sql
   ```

2. **Configuration MySQL (my.cnf ou docker-compose.yml):**
   ```ini
   [mysqld]
   max_connections=100
   max_allowed_packet=256M
   innodb_buffer_pool_size=1GB
   slow_query_log=1
   long_query_time=2
   ```

3. **Restart MySQL:**
   ```bash
   docker restart mysql  # ou service mysql restart
   ```

---

## ✅ Checklist Post-Migration

- [ ] Toutes les migrations appliquées
- [ ] Indices créés avec succès
- [ ] ANALYZE TABLE exécuté
- [ ] MySQL max_connections ≥ 100
- [ ] Backend recompilé avec Vente.java (LAZY fetches)
- [ ] application.properties updated (pool 20, logging WARN)
- [ ] Tests de performance validés
- [ ] Mode offline prêt à déployer

---

## 🔍 SQL de Vérification

```sql
-- Vérifier indices créés
SELECT * FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_NAME = 'ventes' 
ORDER BY SEQ_IN_INDEX;

-- Vérifier colonne client_request_id existe
DESCRIBE ventes;

-- Vérifier taille table
SELECT COUNT(*) as total_ventes FROM ventes;

-- Vérifier status de sync
SELECT sync_status, COUNT(*) 
FROM ventes 
GROUP BY sync_status;
```
