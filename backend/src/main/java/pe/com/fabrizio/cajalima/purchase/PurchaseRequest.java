package pe.com.fabrizio.cajalima.purchase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;
public record PurchaseRequest(@NotNull UUID requestId,@NotBlank @Size(max=160) String description,@Size(max=160) String supplierName,
    @NotNull Method paymentMethod,@NotNull LocalDate purchaseDate,@Size(max=500) String notes,@NotNull @Size(min=1,max=100) List<@NotNull @Valid Item> items){
    public record Item(@NotNull @Positive Long productId,@Min(1) @Max(1000000) int quantity,@NotNull @DecimalMin("0.01") @DecimalMax("99999999.99") @Digits(integer=8,fraction=2) BigDecimal unitCost){}
    public PurchaseRequest{description=SpendingRules.text(description);supplierName=SpendingRules.text(supplierName);notes=SpendingRules.text(notes);}
    @AssertTrue public boolean isTextValid(){return SpendingRules.validText(description,supplierName,notes);}
    @Override public String toString(){return "PurchaseRequest[redacted]";}
}
