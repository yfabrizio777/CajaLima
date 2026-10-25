package pe.com.fabrizio.cajalima.expense;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;
public record ExpenseRequest(@NotNull UUID requestId,@NotBlank @Size(max=160) String description,@NotNull Expense.Category category,
    @NotNull @DecimalMin("0.01") @DecimalMax("999999999999.99") @Digits(integer=12,fraction=2) BigDecimal amount,
    @NotNull Method paymentMethod,@NotNull LocalDate expenseDate,@Size(max=500) String notes){
    public ExpenseRequest{description=SpendingRules.text(description);notes=SpendingRules.text(notes);}
    @AssertTrue public boolean isTextValid(){return SpendingRules.validText(description,notes);}
    @Override public String toString(){return "ExpenseRequest[redacted]";}
}
