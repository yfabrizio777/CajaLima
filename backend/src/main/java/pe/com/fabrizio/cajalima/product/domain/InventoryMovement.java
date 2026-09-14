package pe.com.fabrizio.cajalima.product.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {
    public enum Type { INITIAL, ADJUSTMENT }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "product_id", nullable = false) private Long productId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Type type;
    @Column(nullable = false) private int quantity;
    @Column(name = "previous_stock", nullable = false) private int previousStock;
    @Column(name = "new_stock", nullable = false) private int newStock;
    @Column(nullable = false, length = 240) private String reason;
    @Column(name = "created_by", nullable = false) private Long createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected InventoryMovement() { }
    public InventoryMovement(Long productId, Type type, int previousStock, int newStock, String reason, Long createdBy) {
        this.productId = productId; this.type = type; this.previousStock = previousStock;
        this.newStock = newStock; this.quantity = newStock - previousStock;
        this.reason = reason; this.createdBy = createdBy; this.createdAt = Instant.now();
    }
}
