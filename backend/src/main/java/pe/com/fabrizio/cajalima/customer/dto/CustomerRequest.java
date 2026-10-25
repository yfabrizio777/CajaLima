package pe.com.fabrizio.cajalima.customer.dto;

import java.util.Locale;
import jakarta.validation.constraints.*;
import pe.com.fabrizio.cajalima.customer.domain.DocumentType;

public record CustomerRequest(
        @NotBlank @Size(max = 160) String name,
        DocumentType documentType,
        @Size(max = 32) @Pattern(regexp = "[A-Z0-9][A-Z0-9./-]{0,31}") String documentNumber,
        @Size(max = 32) @Pattern(regexp = "\\+?[0-9]{1,20}") String phone,
        @Email @Size(max = 180) String email,
        @Size(max = 240) String address,
        @Size(max = 1000) String notes) {
    public CustomerRequest {
        name = clean(name);
        documentNumber = clean(documentNumber);
        if (documentNumber != null) {
            documentNumber = documentNumber.replaceAll("(?U)\\s+", "").toUpperCase(Locale.ROOT);
            if (documentType == null) documentType = DocumentType.OTHER;
        }
        phone = clean(phone);
        if (phone != null) phone = phone.replaceAll("(?U)[\\s()\\-]+", "");
        email = clean(email);
        if (email != null) email = email.toLowerCase(Locale.ROOT);
        address = clean(address);
        notes = notes == null || notes.isBlank() ? null : notes.strip();
    }
    private static String clean(String value) {
        if (value == null) return null;
        String normalized = value.replaceAll("(?U)\\s+", " ").strip();
        return normalized.isEmpty() ? null : normalized;
    }
    @AssertTrue(message = "Revisa el formato del documento.")
    public boolean isDocumentValid() {
        if (documentNumber == null) return true;
        return switch (documentType) {
            case DNI -> documentNumber.matches("[0-9]{8}");
            case RUC -> documentNumber.matches("[0-9]{11}");
            case CE, OTHER -> true;
        };
    }
    @Override public String toString() { return "CustomerRequest[redacted]"; }
}
