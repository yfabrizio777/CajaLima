package pe.com.fabrizio.cajalima.sale.dto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import pe.com.fabrizio.cajalima.sale.domain.*;
public record SaleResponse(Long id, List<Item> items, BigDecimal total, PaymentMethod paymentMethod, Long createdBy, Instant createdAt) {
    public record Item(Long productId, String productName, BigDecimal unitPrice, int quantity, BigDecimal subtotal) {
        public static Item from(SaleItem i) { return new Item(i.getProductId(), i.getProductNameSnapshot(), i.getUnitPrice(), i.getQuantity(), i.getSubtotal()); }
    }
    public static SaleResponse from(Sale s, List<SaleItem> items) {
        return new SaleResponse(s.getId(), items.stream().map(Item::from).toList(), s.getTotal(), s.getPaymentMethod(), s.getCreatedBy(), s.getCreatedAt());
    }
}
