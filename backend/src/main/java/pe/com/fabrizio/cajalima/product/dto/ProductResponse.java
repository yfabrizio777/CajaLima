package pe.com.fabrizio.cajalima.product.dto;
import java.math.BigDecimal;
import java.time.Instant;
import pe.com.fabrizio.cajalima.product.domain.Product;
public record ProductResponse(Long id, String name, String sku, BigDecimal salePrice, BigDecimal costPrice,
        int stock, int minimumStock, boolean lowStock, boolean active, Instant createdAt, Instant updatedAt) {
    public static ProductResponse from(Product p) {
        return new ProductResponse(p.getId(), p.getName(), p.getSku(), p.getSalePrice(), p.getCostPrice(),
                p.getStock(), p.getMinimumStock(), p.getStock() <= p.getMinimumStock(), p.isActive(), p.getCreatedAt(), p.getUpdatedAt());
    }
}
