package pe.com.fabrizio.cajalima.product.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.product.dto.*;
import pe.com.fabrizio.cajalima.product.service.ProductService;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;

@RestController @RequestMapping("/api/products")
public class ProductController {
    private final ProductService service;
    public ProductController(ProductService service) { this.service = service; }
    public record StatusRequest(@NotNull Boolean active) { }
    @GetMapping
    public ProductService.ProductPage list(@RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) Boolean active, @RequestParam(required = false) Boolean lowStock,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(search, active, lowStock, page, size);
    }
    @GetMapping("/summary") public ProductService.Summary summary() { return service.summary(); }
    @GetMapping("/{id}") public ProductResponse get(@PathVariable Long id) { return service.get(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request, @AuthenticationPrincipal UserResponse actor) {
        return service.create(request, actor.id());
    }
    @PutMapping("/{id}") public ProductResponse edit(@PathVariable Long id, @Valid @RequestBody UpdateProductRequest request) { return service.edit(id, request); }
    @PatchMapping("/{id}/status") public ProductResponse status(@PathVariable Long id, @Valid @RequestBody StatusRequest request) { return service.status(id, request.active()); }
    @PostMapping("/{id}/stock-adjustments") public ProductResponse adjust(@PathVariable Long id,
            @Valid @RequestBody StockAdjustmentRequest request, @AuthenticationPrincipal UserResponse actor) {
        return service.adjust(id, request, actor.id());
    }
}
