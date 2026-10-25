package pe.com.fabrizio.cajalima.expense;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;

@Entity @Table(name="expenses")
public class Expense {
    public enum Category { RENT,SERVICES,TRANSPORT,SUPPLIES,MAINTENANCE,OTHER }
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(name="request_id",nullable=false,updatable=false) UUID requestId;
    @Column(name="request_fingerprint",nullable=false,updatable=false,length=64) String requestFingerprint;
    @Column(nullable=false,length=160) String description;
    @Enumerated(EnumType.STRING) @Column(nullable=false,updatable=false,length=20) Category category;
    @Column(nullable=false,updatable=false,precision=14,scale=2) BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(name="payment_method",nullable=false,updatable=false,length=20) Method paymentMethod;
    @Column(name="expense_date",nullable=false,updatable=false) LocalDate expenseDate;
    @Column(length=500) String notes;
    @Column(name="created_by",nullable=false,updatable=false) Long createdBy;
    @Column(name="created_at",nullable=false,updatable=false) Instant createdAt;
    @Column(name="updated_at",nullable=false) Instant updatedAt;
    protected Expense(){}
    Expense(ExpenseRequest r,String hash,Long actor){requestId=r.requestId();requestFingerprint=hash;description=r.description();category=r.category();amount=r.amount();paymentMethod=r.paymentMethod();expenseDate=r.expenseDate();notes=r.notes();createdBy=actor;createdAt=Instant.now();updatedAt=createdAt;}
    void edit(String description,String notes){this.description=description;this.notes=notes;updatedAt=Instant.now();}
    @Override public String toString(){return "Expense[redacted]";}
}
