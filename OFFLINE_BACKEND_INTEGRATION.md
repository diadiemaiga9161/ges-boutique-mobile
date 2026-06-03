# Intégration Mode Offline - Backend Spring Boot

## 1. Modification de l'Entité Vente

Ajouter le champ `clientRequestId` à l'entité Vente pour détecter les doublons :

```java
@Entity
@Table(name = "vente")
public class Vente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    // ... autres champs existants ...
    
    @Column(name = "client_request_id", unique = true, nullable = true)
    private String clientRequestId;
    
    // Getters et Setters
    public String getClientRequestId() {
        return clientRequestId;
    }
    
    public void setClientRequestId(String clientRequestId) {
        this.clientRequestId = clientRequestId;
    }
}
```

## 2. Migration Base de Données

Créer une migration (Flyway ou Liquibase) pour ajouter la colonne :

```sql
ALTER TABLE vente ADD COLUMN client_request_id VARCHAR(36);
ALTER TABLE vente ADD CONSTRAINT uc_vente_client_request_id UNIQUE (client_request_id);
```

## 3. Modifier le Contrôleur VenteController

```java
@RestController
@RequestMapping("/api/ventes")
public class VenteController {
    
    @PostMapping
    public ResponseEntity<VenteDto> createVente(
        @RequestBody VenteRequest request,
        @RequestHeader(value = "X-Client-Request-ID", required = false) String clientRequestId
    ) {
        try {
            // Vérifier si la vente avec ce clientRequestId existe déjà
            if (clientRequestId != null && !clientRequestId.isEmpty()) {
                Optional<Vente> existing = venteService.findByClientRequestId(clientRequestId);
                if (existing.isPresent()) {
                    return ResponseEntity.ok(venteMapper.toDto(existing.get()));
                }
            }
            
            Vente vente = venteService.createVente(request);
            vente.setClientRequestId(clientRequestId);
            venteService.save(vente);
            
            return ResponseEntity.ok(venteMapper.toDto(vente));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/credit")
    public ResponseEntity<VenteDto> createVenteCredit(
        @RequestBody VenteCreditRequest request,
        @RequestHeader(value = "X-Client-Request-ID", required = false) String clientRequestId
    ) {
        try {
            if (clientRequestId != null && !clientRequestId.isEmpty()) {
                Optional<Vente> existing = venteService.findByClientRequestId(clientRequestId);
                if (existing.isPresent()) {
                    return ResponseEntity.ok(venteMapper.toDto(existing.get()));
                }
            }
            
            Vente vente = venteService.createVenteCredit(request);
            vente.setClientRequestId(clientRequestId);
            venteService.save(vente);
            
            return ResponseEntity.ok(venteMapper.toDto(vente));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // Autres endpoints peuvent aussi accepter le header X-Client-Request-ID
}
```

## 4. Modifier le Service Vente

```java
@Service
public class VenteService {
    
    @Autowired
    private VenteRepository venteRepository;
    
    public Optional<Vente> findByClientRequestId(String clientRequestId) {
        return venteRepository.findByClientRequestId(clientRequestId);
    }
    
    public void save(Vente vente) {
        venteRepository.save(vente);
    }
    
    // ... autres méthodes existantes ...
}
```

## 5. Modifier le Repository VenteRepository

```java
@Repository
public interface VenteRepository extends JpaRepository<Vente, Long> {
    Optional<Vente> findByClientRequestId(String clientRequestId);
    
    // ... autres méthodes existantes ...
}
```

## 6. Gestion des Erreurs et Retry

Le backend doit gérer les retry avec les règles suivantes :

1. **Doublon détecté** : Si `clientRequestId` existe déjà, retourner la vente existante (statut 200)
2. **Première tentative** : Créer la vente normalement
3. **Stock insuffisant** : Retourner 409 Conflict
4. **Autres erreurs** : Retourner 400 Bad Request ou 500 Server Error

## 7. Logs et Monitoring

Ajouter des logs pour tracer les doublons et les rehentatives :

```java
@PostMapping
public ResponseEntity<VenteDto> createVente(
    @RequestBody VenteRequest request,
    @RequestHeader(value = "X-Client-Request-ID", required = false) String clientRequestId
) {
    if (clientRequestId != null && !clientRequestId.isEmpty()) {
        Optional<Vente> existing = venteService.findByClientRequestId(clientRequestId);
        if (existing.isPresent()) {
            logger.info("Doublon détecté pour clientRequestId: {}", clientRequestId);
            return ResponseEntity.ok(venteMapper.toDto(existing.get()));
        }
    }
    
    logger.info("Création de vente avec clientRequestId: {}", clientRequestId);
    // ... créer la vente ...
}
```

## 8. Endpoints Spécialisés pour la Synchronisation (Optionnel)

Créer un endpoint pour récupérer le statut de synchronisation :

```java
@GetMapping("/sync/status/{clientRequestId}")
public ResponseEntity<VenteSyncStatusDto> getSyncStatus(
    @PathVariable String clientRequestId
) {
    Optional<Vente> vente = venteService.findByClientRequestId(clientRequestId);
    if (vente.isPresent()) {
        return ResponseEntity.ok(new VenteSyncStatusDto(
            clientRequestId,
            "SUCCESS",
            vente.get().getId(),
            vente.get().getDateVente()
        ));
    }
    return ResponseEntity.notFound().build();
}
```

## 9. Considérations de Performance

- Ajouter un index sur la colonne `client_request_id` pour les recherches rapides
- Envisager une archive des ventes par `clientRequestId` après une période (ex: 30 jours)

```sql
CREATE INDEX idx_vente_client_request_id ON vente(client_request_id);
```

## 10. Sécurité

- Valider le format de `clientRequestId` (UUID v4)
- Ajouter une authentification pour éviter que d'autres utilisateurs accèdent aux ventes par `clientRequestId`
- Implémenter une limitation du nombre de retry (ex: max 3 tentatives)
