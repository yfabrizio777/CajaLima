package pe.com.fabrizio.cajalima.customer.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.customer.dto.*;
import pe.com.fabrizio.cajalima.customer.service.CustomerService;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerService customers;
    public CustomerController(CustomerService customers) { this.customers = customers; }
    public record StatusRequest(@NotNull Boolean active) { }
    @GetMapping public CustomerService.CustomerPage list(@RequestParam(defaultValue = "") String search, @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return customers.list(search, active, page, size);
    }
    @GetMapping("/{id}") public CustomerResponse get(@PathVariable Long id) { return customers.get(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse create(@Valid @RequestBody CustomerRequest request) { return customers.create(request); }
    @PutMapping("/{id}") public CustomerResponse edit(@PathVariable Long id, @Valid @RequestBody CustomerRequest request) { return customers.edit(id, request); }
    @PatchMapping("/{id}/status") public CustomerResponse status(@PathVariable Long id, @Valid @RequestBody StatusRequest request) { return customers.status(id, request.active()); }
}
