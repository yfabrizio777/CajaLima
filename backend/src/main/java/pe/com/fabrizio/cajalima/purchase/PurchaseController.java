package pe.com.fabrizio.cajalima.purchase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
@RestController @RequestMapping("/api/purchases")
public class PurchaseController {
    private final PurchaseService service;
    public PurchaseController(PurchaseService service){this.service=service;}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public PurchaseService.Response create(@Valid @RequestBody PurchaseRequest r,@AuthenticationPrincipal UserResponse actor){return service.create(r,actor.id());}
    @GetMapping public PurchaseService.Page list(@RequestParam(defaultValue="") String q,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(q,from,to,page,size);}
    @GetMapping("/summary") public PurchaseService.Summary summary(){return service.summary();}
    @GetMapping("/{id}") public PurchaseService.Response get(@PathVariable Long id){return service.get(id);}
    public record Edit(@NotBlank @Size(max=160) String description,@Size(max=160) String supplierName,@Size(max=500) String notes){public Edit{description=SpendingRules.text(description);supplierName=SpendingRules.text(supplierName);notes=SpendingRules.text(notes);}@AssertTrue public boolean isTextValid(){return SpendingRules.validText(description,supplierName,notes);}@Override public String toString(){return "PurchaseEdit[redacted]";}}
    @PutMapping("/{id}/details") public PurchaseService.Response edit(@PathVariable Long id,@Valid @RequestBody Edit r){return service.edit(id,r.description(),r.supplierName(),r.notes());}
}
