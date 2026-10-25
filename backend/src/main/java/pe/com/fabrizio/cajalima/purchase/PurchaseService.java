package pe.com.fabrizio.cajalima.purchase;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.product.domain.*;
import pe.com.fabrizio.cajalima.product.repository.*;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;
import static pe.com.fabrizio.cajalima.spending.SpendingRules.*;

@Service @Transactional(readOnly=true) @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
public class PurchaseService {
    private final PurchaseRepository purchases;
    private final PurchaseItemRepository items;
    private final ProductRepository products;
    private final InventoryMovementRepository movements;
    public PurchaseService(PurchaseRepository purchases,PurchaseItemRepository items,ProductRepository products,InventoryMovementRepository movements){this.purchases=purchases;this.items=items;this.products=products;this.movements=movements;}
    public record Row(Long id,String description,String supplierName,String total,Method paymentMethod,LocalDate purchaseDate,String notes,Long createdBy,Instant createdAt,Instant updatedAt){@Override public String toString(){return "PurchaseRow[redacted]";}}
    public record Item(Long id,Long productId,String productName,int quantity,String unitCost,String subtotal){}
    public record Response(Row purchase,List<Item> items){}
    private Row row(Purchase p){return new Row(p.id,p.description,p.supplierName,money(p.total),p.paymentMethod,p.purchaseDate,p.notes,p.createdBy,p.createdAt,p.updatedAt);}
    private Response response(Purchase p){return new Response(row(p),items.findByPurchaseIdOrderById(p.id).stream().map(i->new Item(i.id,i.productId,i.productName,i.quantity,money(i.unitCost),money(i.subtotal))).toList());}
    private Purchase find(Long id){return purchases.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"Compra no encontrada."));}
    public Response get(Long id){return response(find(id));}
    @Transactional public Response create(PurchaseRequest r,Long actor){
        date(r.purchaseDate());var ordered=r.items().stream().sorted(Comparator.comparing(PurchaseRequest.Item::productId)).toList();
        if(ordered.stream().map(PurchaseRequest.Item::productId).distinct().count()!=ordered.size())throw error(HttpStatus.BAD_REQUEST,"Agrupa cada producto en una sola línea.");
        var fields=new ArrayList<Object>(List.of(r.description(),r.paymentMethod(),r.purchaseDate()));fields.add(r.supplierName());fields.add(r.notes());
        for(var i:ordered){fields.add(i.productId());fields.add(i.quantity());fields.add(money(i.unitCost()));}
        String fingerprint=hash(fields.toArray());var previous=purchases.findByRequestId(r.requestId());
        if(previous.isPresent())return replayResponse(previous.get(),actor,fingerprint);
        List<Product> locked=new ArrayList<>();
        for(var i:ordered)locked.add(products.findLocked(i.productId()).orElseThrow(()->error(HttpStatus.NOT_FOUND,"Uno de los productos no existe.")));
        previous=purchases.findByRequestId(r.requestId());if(previous.isPresent())return replayResponse(previous.get(),actor,fingerprint);
        BigDecimal total=BigDecimal.ZERO;
        for(int n=0;n<locked.size();n++){
            var p=locked.get(n);var i=ordered.get(n);
            if(!p.isActive())throw error(HttpStatus.CONFLICT,"El producto "+p.getName()+" está inactivo.");
            if((long)p.getStock()+i.quantity()>1000000)throw error(HttpStatus.CONFLICT,"La compra supera el stock máximo de "+p.getName()+".");
            total=total.add(i.unitCost().multiply(BigDecimal.valueOf(i.quantity())));
        }
        if(total.compareTo(MAX)>0)throw error(HttpStatus.BAD_REQUEST,"El total supera el límite permitido.");
        var purchase=purchases.saveAndFlush(new Purchase(r,fingerprint,total,actor));
        for(int n=0;n<locked.size();n++){
            var p=locked.get(n);var i=ordered.get(n);int next=p.getStock()+i.quantity();
            items.save(new PurchaseItem(purchase.id,p.getId(),p.getName(),i.quantity(),i.unitCost()));
            movements.save(InventoryMovement.purchase(p.getId(),p.getStock(),next,actor,purchase.id));p.adjustStock(next);
        }
        products.flush();items.flush();movements.flush();return response(purchase);
    }
    private Response replayResponse(Purchase p,Long actor,String fingerprint){replay(p.createdBy,actor,p.requestFingerprint,fingerprint);return response(p);}
    public record Page(List<Row> items,long total,int page,int size){}
    public Page list(String q,LocalDate from,LocalDate to,int page,int size){
        var paging=SpendingRules.page(page,size,q,from,to);
        Specification<Purchase> filter=(root,query,cb)->{
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
            if(!q.isBlank()){String term=q.strip().toLowerCase(Locale.ROOT);predicates.add(cb.or(cb.greaterThan(cb.locate(cb.lower(root.get("description")),term),0),cb.greaterThan(cb.locate(cb.lower(root.get("supplierName")),term),0)));}
            if(from!=null)predicates.add(cb.greaterThanOrEqualTo(root.get("purchaseDate"),from));if(to!=null)predicates.add(cb.lessThanOrEqualTo(root.get("purchaseDate"),to));return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));};
        var result=purchases.findAll(filter,paging);return new Page(result.map(this::row).getContent(),result.getTotalElements(),page,size);
    }
    public record Summary(String total,LocalDate date){}
    public Summary summary(){var today=LocalDate.now(ZoneId.of("America/Lima"));return new Summary(money(purchases.total(today)),today);}
    @Transactional @PreAuthorize("hasRole('ADMIN')") public Response edit(Long id,String description,String supplierName,String notes){var p=find(id);p.edit(description,supplierName,notes);return response(p);}
}
