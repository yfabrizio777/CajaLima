package pe.com.fabrizio.cajalima.purchase;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;
@Entity @Table(name="purchases")
public class Purchase {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(name="request_id",nullable=false,updatable=false) UUID requestId;
    @Column(name="request_fingerprint",nullable=false,updatable=false,length=64) String requestFingerprint;
    @Column(nullable=false,length=160) String description;
    @Column(name="supplier_name",length=160) String supplierName;
    @Column(nullable=false,updatable=false,precision=14,scale=2) BigDecimal total;
    @Enumerated(EnumType.STRING) @Column(name="payment_method",nullable=false,updatable=false,length=20) Method paymentMethod;
    @Column(name="purchase_date",nullable=false,updatable=false) LocalDate purchaseDate;
    @Column(length=500) String notes;
    @Column(name="created_by",nullable=false,updatable=false) Long createdBy;
    @Column(name="created_at",nullable=false,updatable=false) Instant createdAt;
    @Column(name="updated_at",nullable=false) Instant updatedAt;
    protected Purchase(){}
    Purchase(PurchaseRequest r,String hash,BigDecimal total,Long actor){requestId=r.requestId();requestFingerprint=hash;description=r.description();supplierName=r.supplierName();this.total=total;paymentMethod=r.paymentMethod();purchaseDate=r.purchaseDate();notes=r.notes();createdBy=actor;createdAt=Instant.now();updatedAt=createdAt;}
    void edit(String description,String supplierName,String notes){this.description=description;this.supplierName=supplierName;this.notes=notes;updatedAt=Instant.now();}
    @Override public String toString(){return "Purchase[redacted]";}
}
