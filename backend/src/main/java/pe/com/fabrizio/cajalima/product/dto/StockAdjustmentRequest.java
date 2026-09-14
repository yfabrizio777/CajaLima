package pe.com.fabrizio.cajalima.product.dto;
import jakarta.validation.constraints.*;
public record StockAdjustmentRequest(@NotNull @Min(0) @Max(1000000) Integer newStock,
        @NotBlank @Size(max = 240) String reason) {
    public StockAdjustmentRequest { reason = reason == null ? null : reason.strip(); }
}
