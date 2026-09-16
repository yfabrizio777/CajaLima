package pe.com.fabrizio.cajalima.sale.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.product.domain.*;
import pe.com.fabrizio.cajalima.product.repository.*;
import pe.com.fabrizio.cajalima.sale.domain.*;
import pe.com.fabrizio.cajalima.sale.dto.*;
import pe.com.fabrizio.cajalima.sale.repository.*;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
public class SaleService {
    private static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static final BigDecimal MAX_TOTAL = new BigDecimal("999999999999.99");
    private final SaleRepository sales;
    private final SaleItemRepository items;
    private final ProductRepository products;
    private final InventoryMovementRepository movements;
    public SaleService(SaleRepository sales, SaleItemRepository items, ProductRepository products, InventoryMovementRepository movements) {
        this.sales = sales; this.items = items; this.products = products; this.movements = movements;
    }
    private SaleResponse response(Sale sale) { return SaleResponse.from(sale, items.findBySaleIdOrderById(sale.getId())); }
    public SaleResponse get(Long id) { return response(sales.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Venta no encontrada."))); }
    public record SaleRow(Long id, BigDecimal total, PaymentMethod paymentMethod, Long createdBy, Instant createdAt) {
        static SaleRow from(Sale sale) { return new SaleRow(sale.getId(), sale.getTotal(), sale.getPaymentMethod(), sale.getCreatedBy(), sale.getCreatedAt()); }
    }
    public record SalePage(List<SaleRow> items, long total, int page, int size) { }
    public SalePage list(LocalDate date, int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw error(HttpStatus.BAD_REQUEST, "Revisa la página solicitada.");
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<Sale> result = date == null ? sales.findAll(pageable) :
                sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(date.atStartOfDay(LIMA).toInstant(), date.plusDays(1).atStartOfDay(LIMA).toInstant(), pageable);
        return new SalePage(result.map(SaleRow::from).getContent(), result.getTotalElements(), page, size);
    }
    public record Summary(BigDecimal total, long count, LocalDate date) { }
    public Summary summary() {
        LocalDate today = LocalDate.now(LIMA);
        var totals = sales.summarize(today.atStartOfDay(LIMA).toInstant(), today.plusDays(1).atStartOfDay(LIMA).toInstant());
        return new Summary(totals.getTotal(), totals.getCount(), today);
    }

    @Transactional
    public SaleResponse create(CreateSaleRequest request, Long actor) {
        var ordered = request.items().stream().sorted(Comparator.comparing(CreateSaleRequest.Item::productId)).toList();
        if (ordered.stream().map(CreateSaleRequest.Item::productId).distinct().count() != ordered.size())
            throw error(HttpStatus.BAD_REQUEST, "Agrupa las cantidades de cada producto en una sola línea.");
        String fingerprint = fingerprint(request.paymentMethod(), ordered);
        var previous = sales.findByRequestId(request.requestId());
        if (previous.isPresent()) return replay(previous.get(), actor, fingerprint);

        // Every stock writer uses the same row lock; sorted IDs prevent opposite-order deadlocks.
        List<Product> locked = new ArrayList<>();
        for (var item : ordered) locked.add(products.findLocked(item.productId())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Uno de los productos ya no está disponible.")));
        previous = sales.findByRequestId(request.requestId());
        if (previous.isPresent()) return replay(previous.get(), actor, fingerprint);
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < locked.size(); i++) {
            Product p = locked.get(i);
            int quantity = ordered.get(i).quantity();
            if (!p.isActive()) throw error(HttpStatus.CONFLICT, "El producto " + p.getName() + " está inactivo.");
            if (p.getStock() < quantity) throw error(HttpStatus.CONFLICT, "Ya no quedan suficientes unidades de " + p.getName() + ".");
            total = total.add(p.getSalePrice().multiply(BigDecimal.valueOf(quantity)));
        }
        if (total.compareTo(MAX_TOTAL) > 0) throw error(HttpStatus.BAD_REQUEST, "El importe supera el límite permitido para una venta.");
        Sale sale = sales.saveAndFlush(new Sale(request.requestId(), fingerprint, total, request.paymentMethod(), actor));
        for (int i = 0; i < locked.size(); i++) {
            Product p = locked.get(i);
            int quantity = ordered.get(i).quantity();
            items.save(new SaleItem(sale.getId(), p.getId(), p.getName(), p.getSalePrice(), quantity));
            movements.save(InventoryMovement.sale(p.getId(), p.getStock(), p.getStock() - quantity, actor, sale.getId()));
            p.adjustStock(p.getStock() - quantity);
        }
        products.flush();
        return response(sale);
    }
    private SaleResponse replay(Sale sale, Long actor, String fingerprint) {
        if (!sale.getCreatedBy().equals(actor) || !sale.getRequestFingerprint().equals(fingerprint))
            throw error(HttpStatus.CONFLICT, "Esta referencia ya corresponde a otra solicitud. Revisa tus ventas.");
        return response(sale);
    }
    private String fingerprint(PaymentMethod method, List<CreateSaleRequest.Item> ordered) {
        StringBuilder canonical = new StringBuilder(method.name());
        for (var item : ordered) canonical.append(':').append(item.productId()).append('=').append(item.quantity());
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException("SHA-256 unavailable", ex); }
    }
    private static ApiException error(HttpStatus status, String message) { return new ApiException(status, message); }
}
