package pe.com.fabrizio.cajalima.product.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "products")
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 160) private String name;
    @Column(unique = true, length = 64) private String sku;
    @Column(name = "sale_price", nullable = false, precision = 10, scale = 2) private BigDecimal salePrice;
    @Column(name = "cost_price", precision = 10, scale = 2) private BigDecimal costPrice;
    @Column(nullable = false) private int stock;
    @Column(name = "minimum_stock", nullable = false) private int minimumStock;
    @Column(nullable = false) private boolean active;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Product() { }
    public Product(String name, String sku, BigDecimal salePrice, BigDecimal costPrice, int stock, int minimumStock, boolean active) {
        edit(name, sku, salePrice, costPrice, minimumStock);
        this.stock = stock;
        this.active = active;
    }
    public void edit(String name, String sku, BigDecimal salePrice, BigDecimal costPrice, int minimumStock) {
        this.name = name; this.sku = sku; this.salePrice = salePrice;
        this.costPrice = costPrice; this.minimumStock = minimumStock;
    }
    public void adjustStock(int stock) { this.stock = stock; }
    public void changeStatus(boolean active) { this.active = active; }
    @PrePersist void create() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void update() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getSku() { return sku; }
    public BigDecimal getSalePrice() { return salePrice; }
    public BigDecimal getCostPrice() { return costPrice; }
    public int getStock() { return stock; }
    public int getMinimumStock() { return minimumStock; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
