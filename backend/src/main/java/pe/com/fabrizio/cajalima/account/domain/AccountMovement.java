package pe.com.fabrizio.cajalima.account.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name="customer_account_movements")
public class AccountMovement {
    public enum Type { CREDIT, PAYMENT }
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="customer_id",nullable=false,updatable=false) private Long customerId;
    @Column(name="sale_id",updatable=false) private Long saleId;
    @Enumerated(EnumType.STRING) @Column(nullable=false,updatable=false,length=10) private Type type;
    @Column(nullable=false,updatable=false,precision=14,scale=2) private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(name="payment_method",updatable=false,length=20) private AccountPaymentMethod paymentMethod;
    @Column(name="sale_payment_method",updatable=false,length=20) private String salePaymentMethod;
    @Column(updatable=false,length=240) private String note;
    @Column(name="created_by",nullable=false,updatable=false) private Long createdBy;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="request_id",updatable=false) private UUID requestId;
    @Column(name="request_fingerprint",updatable=false,length=64) private String requestFingerprint;
    protected AccountMovement() { }
    public static AccountMovement credit(Long customerId,Long saleId,BigDecimal amount,Long actor) {
        var m=new AccountMovement(); m.customerId=customerId; m.saleId=saleId; m.type=Type.CREDIT; m.amount=amount;
        m.salePaymentMethod="CREDIT"; m.createdBy=actor; m.createdAt=Instant.now(); return m;
    }
    public static AccountMovement payment(Long customerId,BigDecimal amount,AccountPaymentMethod method,String note,Long actor,UUID requestId,String fingerprint) {
        var m=new AccountMovement(); m.customerId=customerId; m.type=Type.PAYMENT; m.amount=amount; m.paymentMethod=method;
        m.note=note; m.createdBy=actor; m.createdAt=Instant.now(); m.requestId=requestId; m.requestFingerprint=fingerprint; return m;
    }
    public Long getId(){return id;} public Long getCustomerId(){return customerId;} public Long getSaleId(){return saleId;}
    public Type getType(){return type;} public BigDecimal getAmount(){return amount;} public AccountPaymentMethod getPaymentMethod(){return paymentMethod;}
    public String getNote(){return note;} public Long getCreatedBy(){return createdBy;} public Instant getCreatedAt(){return createdAt;}
    public String getRequestFingerprint(){return requestFingerprint;}
}
