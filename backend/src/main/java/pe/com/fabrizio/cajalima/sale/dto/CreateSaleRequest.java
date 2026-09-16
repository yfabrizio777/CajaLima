package pe.com.fabrizio.cajalima.sale.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;
import pe.com.fabrizio.cajalima.sale.domain.PaymentMethod;
public record CreateSaleRequest(@NotNull UUID requestId, @NotNull PaymentMethod paymentMethod,
        @NotEmpty @Size(max = 100) List<@NotNull @Valid Item> items) {
    public record Item(@NotNull @Positive Long productId, @NotNull @Min(1) @Max(1000000) Integer quantity) { }
}
