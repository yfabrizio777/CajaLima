package pe.com.fabrizio.cajalima.expense;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.spending.SpendingRules;
import pe.com.fabrizio.cajalima.spending.SpendingRules.Method;
import static pe.com.fabrizio.cajalima.spending.SpendingRules.*;

@Service @Transactional(readOnly=true) @PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
public class ExpenseService {
    private final ExpenseRepository expenses;
    public ExpenseService(ExpenseRepository expenses){this.expenses=expenses;}
    public record Response(Long id,String description,Expense.Category category,String amount,Method paymentMethod,LocalDate expenseDate,String notes,Long createdBy,Instant createdAt,Instant updatedAt){@Override public String toString(){return "ExpenseResponse[redacted]";}}
    private Response response(Expense e){return new Response(e.id,e.description,e.category,money(e.amount),e.paymentMethod,e.expenseDate,e.notes,e.createdBy,e.createdAt,e.updatedAt);}
    public Response get(Long id){return response(find(id));}
    private Expense find(Long id){return expenses.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"Gasto no encontrado."));}
    @Transactional public Response create(ExpenseRequest r,Long actor){
        date(r.expenseDate());String hash=hash(r.description(),r.category(),money(r.amount()),r.paymentMethod(),r.expenseDate(),r.notes());
        var old=expenses.findByRequestId(r.requestId());if(old.isPresent()){var e=old.get();replay(e.createdBy,actor,e.requestFingerprint,hash);return response(e);}
        return response(expenses.saveAndFlush(new Expense(r,hash,actor)));
    }
    public record Page(List<Response> items,long total,int page,int size){}
    public Page list(String q,LocalDate from,LocalDate to,Expense.Category category,int page,int size){
        var paging=SpendingRules.page(page,size,q,from,to);
        Specification<Expense> filter=(root,query,cb)->{
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
            if(!q.isBlank())predicates.add(cb.greaterThan(cb.locate(cb.lower(root.get("description")),q.strip().toLowerCase(Locale.ROOT)),0));
            if(from!=null)predicates.add(cb.greaterThanOrEqualTo(root.get("expenseDate"),from));if(to!=null)predicates.add(cb.lessThanOrEqualTo(root.get("expenseDate"),to));if(category!=null)predicates.add(cb.equal(root.get("category"),category));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));};
        var result=expenses.findAll(filter,paging);return new Page(result.map(this::response).getContent(),result.getTotalElements(),page,size);
    }
    public record Summary(String total,LocalDate date){}
    public Summary summary(){var today=LocalDate.now(ZoneId.of("America/Lima"));return new Summary(money(expenses.total(today)),today);}
    @Transactional @PreAuthorize("hasRole('ADMIN')") public Response edit(Long id,String description,String notes){var e=find(id);e.edit(description,notes);return response(e);}
}
