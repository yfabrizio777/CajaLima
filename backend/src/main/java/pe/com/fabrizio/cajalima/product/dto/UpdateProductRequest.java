package pe.com.fabrizio.cajalima.product.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record UpdateProductRequest(
        @NotBlank @Size(max = 160) String name,
        @Pattern(regexp = "[A-Z0-9][A-Z0-9._-]{0,63}") String sku,
        @NotNull @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal salePrice,
        @DecimalMin("0") @Digits(integer = 8, fraction = 2) BigDecimal costPrice,
        @NotNull @Min(0) @Max(1000000) Integer minimumStock) {
    public UpdateProductRequest {
        name = name == null ? null : name.strip();
        sku = CreateProductRequest.normalizeSku(sku);
    }
}
