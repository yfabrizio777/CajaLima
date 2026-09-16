package pe.com.fabrizio.cajalima.sale.controller;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.sale.dto.*;
import pe.com.fabrizio.cajalima.sale.service.SaleService;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
@RestController @RequestMapping("/api/sales")
public class SaleController {
    private final SaleService service;
    public SaleController(SaleService service) { this.service = service; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse create(@Valid @RequestBody CreateSaleRequest request, @AuthenticationPrincipal UserResponse actor) { return service.create(request, actor.id()); }
    @GetMapping public SaleService.SalePage list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return service.list(date, page, size); }
    @GetMapping("/{id}") public SaleResponse get(@PathVariable Long id) { return service.get(id); }
    @GetMapping("/summary") public SaleService.Summary summary() { return service.summary(); }
}
