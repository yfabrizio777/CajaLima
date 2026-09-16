package pe.com.fabrizio.cajalima.sale.domain;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "sales")
public class Sale {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "request_id", nullable = false, unique = true) private UUID requestId;
    @Column(name = "request_fingerprint", nullable = false, length = 64) private String requestFingerprint;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal total;
    @Enumerated(EnumType.STRING) @Column(name = "payment_method", nullable = false, length = 20) private PaymentMethod paymentMethod;
    @Column(name = "created_by", nullable = false) private Long createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected Sale() { }
    public Sale(UUID requestId, String fingerprint, BigDecimal total, PaymentMethod paymentMethod, Long createdBy) {
        this.requestId = requestId; this.requestFingerprint = fingerprint; this.total = total;
        this.paymentMethod = paymentMethod; this.createdBy = createdBy; this.createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public BigDecimal getTotal() { return total; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public Long getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
