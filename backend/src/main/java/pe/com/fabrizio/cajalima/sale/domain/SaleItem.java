package pe.com.fabrizio.cajalima.sale.domain;
import jakarta.persistence.*;
import java.math.BigDecimal;
@Entity @Table(name = "sale_items")
public class SaleItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "sale_id", nullable = false) private Long saleId;
    @Column(name = "product_id", nullable = false) private Long productId;
    @Column(name = "product_name_snapshot", nullable = false, length = 160) private String productNameSnapshot;
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2) private BigDecimal unitPrice;
    @Column(nullable = false) private int quantity;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal subtotal;
    protected SaleItem() { }
    public SaleItem(Long saleId, Long productId, String name, BigDecimal unitPrice, int quantity) {
        this.saleId = saleId; this.productId = productId; this.productNameSnapshot = name;
        this.unitPrice = unitPrice; this.quantity = quantity; this.subtotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
    public Long getProductId() { return productId; }
    public String getProductNameSnapshot() { return productNameSnapshot; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public int getQuantity() { return quantity; }
    public BigDecimal getSubtotal() { return subtotal; }
}
