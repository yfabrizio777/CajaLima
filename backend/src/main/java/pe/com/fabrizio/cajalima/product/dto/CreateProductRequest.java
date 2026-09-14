package pe.com.fabrizio.cajalima.product.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Locale;

public record CreateProductRequest(
        @NotBlank @Size(max = 160) String name,
        @Pattern(regexp = "[A-Z0-9][A-Z0-9._-]{0,63}") String sku,
        @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal salePrice,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal costPrice,
        @NotNull @Min(0) @Max(1000000) Integer initialStock,
        @NotNull @Min(0) @Max(1000000) Integer minimumStock,
        @NotNull Boolean active) {
    public CreateProductRequest {
        name = name == null ? null : name.strip();
        sku = normalizeSku(sku);
    }
    public static String normalizeSku(String value) {
        return value == null || value.isBlank() ? null : value.strip().toUpperCase(Locale.ROOT);
    }
}
