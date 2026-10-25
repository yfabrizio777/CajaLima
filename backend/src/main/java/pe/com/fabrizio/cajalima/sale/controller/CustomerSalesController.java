package pe.com.fabrizio.cajalima.sale.controller;

import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.sale.service.SaleService;

// The sales module owns this read endpoint; Customer never depends on Sale services.
@RestController
@RequestMapping("/api/customers/{customerId}/sales")
public class CustomerSalesController {
    private final SaleService sales;
    public CustomerSalesController(SaleService sales) { this.sales = sales; }
    @GetMapping
    public SaleService.CustomerSalePage list(@PathVariable Long customerId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return sales.customerSales(customerId, page, size);
    }
}
