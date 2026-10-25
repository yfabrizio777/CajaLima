package pe.com.fabrizio.cajalima.customer.dto;

import java.time.Instant;
import pe.com.fabrizio.cajalima.customer.domain.*;

public record CustomerResponse(Long id, String name, DocumentType documentType, String documentNumber,
        String phone, String email, String address, String notes, boolean active, Instant createdAt, Instant updatedAt) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getDocumentType(), c.getDocumentNumber(), c.getPhone(),
                c.getEmail(), c.getAddress(), c.getNotes(), c.isActive(), c.getCreatedAt(), c.getUpdatedAt());
    }
    @Override public String toString() { return "CustomerResponse[redacted]"; }
}
