package pe.com.fabrizio.cajalima.customer.domain;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "customers")
public class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 160) private String name;
    @Enumerated(EnumType.STRING) @Column(name = "document_type", length = 10) private DocumentType documentType;
    @Column(name = "document_number", length = 32) private String documentNumber;
    @Column(length = 32) private String phone;
    @Column(length = 180) private String email;
    @Column(length = 240) private String address;
    @Column(length = 1000) private String notes;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Customer() { }
    public Customer(String name, DocumentType documentType, String documentNumber, String phone, String email, String address, String notes) {
        edit(name, documentType, documentNumber, phone, email, address, notes);
    }
    public void edit(String name, DocumentType documentType, String documentNumber, String phone, String email, String address, String notes) {
        this.name = name; this.documentType = documentType; this.documentNumber = documentNumber;
        this.phone = phone; this.email = email; this.address = address; this.notes = notes;
    }
    public void changeStatus(boolean active) { this.active = active; }
    @PrePersist void create() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void update() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public String getName() { return name; }
    public DocumentType getDocumentType() { return documentType; }
    public String getDocumentNumber() { return documentNumber; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getAddress() { return address; }
    public String getNotes() { return notes; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
