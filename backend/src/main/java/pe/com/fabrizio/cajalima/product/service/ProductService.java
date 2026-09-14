package pe.com.fabrizio.cajalima.product.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.product.domain.*;
import pe.com.fabrizio.cajalima.product.dto.*;
import pe.com.fabrizio.cajalima.product.repository.*;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
public class ProductService {
    private final ProductRepository products;
    private final InventoryMovementRepository movements;
    public ProductService(ProductRepository products, InventoryMovementRepository movements) {
        this.products = products; this.movements = movements;
    }
    public record ProductPage(List<ProductResponse> items, long total, int page, int size) { }
    public record Summary(long activeProducts, long lowStockProducts) { }

    public ProductPage list(String search, Boolean active, Boolean lowStock, int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100 || search.length() > 160) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Revisa la búsqueda o la página solicitada.");
        }
        var result = products.findAll(filter(search, active, lowStock), PageRequest.of(page, size, Sort.by("name", "id")));
        return new ProductPage(result.map(ProductResponse::from).getContent(), result.getTotalElements(), page, size);
    }
    private Specification<Product> filter(String search, Boolean active, Boolean lowStock) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!search.isBlank()) {
                String literal = search.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(cb.or(cb.like(cb.lower(root.get("name")), "%" + literal + "%", '\\'),
                        cb.like(cb.lower(root.get("sku")), "%" + literal + "%", '\\')));
            }
            if (active != null) predicates.add(cb.equal(root.get("active"), active));
            if (lowStock != null) {
                Predicate low = cb.lessThanOrEqualTo(root.<Integer>get("stock"), root.<Integer>get("minimumStock"));
                predicates.add(lowStock ? low : cb.not(low));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
    public Summary summary() {
        return new Summary(products.count(filter("", true, null)), products.count(filter("", true, true)));
    }
    public ProductResponse get(Long id) { return ProductResponse.from(products.findById(id).orElseThrow(ProductService::notFound)); }
    private Product locked(Long id) { return products.findLocked(id).orElseThrow(ProductService::notFound); }
    private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "Producto no encontrado."); }

    @Transactional @PreAuthorize("hasRole('ADMIN')")
    public ProductResponse create(CreateProductRequest r, Long actor) {
        Product p = products.saveAndFlush(new Product(r.name(), r.sku(), r.salePrice(), r.costPrice(), r.initialStock(), r.minimumStock(), r.active()));
        if (p.getStock() > 0) movements.save(new InventoryMovement(p.getId(), InventoryMovement.Type.INITIAL, 0, p.getStock(), "Stock inicial", actor));
        return ProductResponse.from(p);
    }
    @Transactional @PreAuthorize("hasRole('ADMIN')")
    public ProductResponse edit(Long id, UpdateProductRequest r) {
        Product p = locked(id);
        p.edit(r.name(), r.sku(), r.salePrice(), r.costPrice(), r.minimumStock());
        products.flush();
        return ProductResponse.from(p);
    }
    @Transactional @PreAuthorize("hasRole('ADMIN')")
    public ProductResponse status(Long id, boolean active) {
        Product p = locked(id); p.changeStatus(active); products.flush(); return ProductResponse.from(p);
    }
    @Transactional @PreAuthorize("hasRole('ADMIN')")
    public ProductResponse adjust(Long id, StockAdjustmentRequest r, Long actor) {
        Product p = locked(id);
        if (p.getStock() == r.newStock()) throw new ApiException(HttpStatus.BAD_REQUEST, "El nuevo stock debe ser diferente al actual.");
        movements.save(new InventoryMovement(id, InventoryMovement.Type.ADJUSTMENT, p.getStock(), r.newStock(), r.reason(), actor));
        p.adjustStock(r.newStock()); products.flush(); return ProductResponse.from(p);
    }
}
