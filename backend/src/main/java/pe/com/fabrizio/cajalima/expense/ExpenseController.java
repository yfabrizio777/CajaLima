package pe.com.fabrizio.cajalima.expense;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
@RestController @RequestMapping("/api/expenses")
public class ExpenseController {
    private final ExpenseService service;
    public ExpenseController(ExpenseService service){this.service=service;}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ExpenseService.Response create(@Valid @RequestBody ExpenseRequest r,@AuthenticationPrincipal UserResponse actor){return service.create(r,actor.id());}
    @GetMapping public ExpenseService.Page list(@RequestParam(defaultValue="") String q,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) Expense.Category category,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(q,from,to,category,page,size);}
    @GetMapping("/summary") public ExpenseService.Summary summary(){return service.summary();}
    @GetMapping("/{id}") public ExpenseService.Response get(@PathVariable Long id){return service.get(id);}
    public record Edit(@NotBlank @Size(max=160) String description,@Size(max=500) String notes){public Edit{description=SpendingRules.text(description);notes=SpendingRules.text(notes);}@AssertTrue public boolean isTextValid(){return SpendingRules.validText(description,notes);}@Override public String toString(){return "ExpenseEdit[redacted]";}}
    @PutMapping("/{id}/details") public ExpenseService.Response edit(@PathVariable Long id,@Valid @RequestBody Edit r){return service.edit(id,r.description(),r.notes());}
}
