package pe.com.fabrizio.cajalima.customer.service;

import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.customer.domain.Customer;
import pe.com.fabrizio.cajalima.customer.dto.*;
import pe.com.fabrizio.cajalima.customer.repository.CustomerRepository;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
public class CustomerService {
    private final CustomerRepository customers;
    public CustomerService(CustomerRepository customers) { this.customers = customers; }
    public record CustomerPage(List<CustomerResponse> items, long total, int page, int size) { }
    public CustomerPage list(String search, int page, int size) {
        if (search.length() > 160 || page < 0 || page > 100000 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Revisa la búsqueda o la página solicitada.");
        String term = search.replaceAll("(?U)\\s+", " ").strip().toLowerCase(Locale.ROOT);
        Specification<Customer> filter = (root, query, cb) -> {
            if (term.isBlank()) return cb.conjunction();
            String text = like(term);
            String document = like(term.replace(" ", ""));
            String phone = term.replaceAll("[ ()-]", "");
            return cb.or(cb.like(cb.lower(root.get("name")), text, '\\'),
                    cb.like(cb.lower(root.get("documentNumber")), document, '\\'),
                    phone.isEmpty() ? cb.disjunction() : cb.like(root.get("phone"), like(phone), '\\'));
        };
        var result = customers.findAll(filter, PageRequest.of(page, size, Sort.by("name", "id")));
        return new CustomerPage(result.map(CustomerResponse::from).getContent(), result.getTotalElements(), page, size);
    }
    private static String like(String value) {
        return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
    public CustomerResponse get(Long id) { return CustomerResponse.from(customers.findById(id).orElseThrow(CustomerService::notFound)); }
    @Transactional
    public CustomerResponse create(CustomerRequest r) {
        return CustomerResponse.from(customers.saveAndFlush(new Customer(r.name(), r.documentType(), r.documentNumber(), r.phone(), r.email(), r.address(), r.notes())));
    }
    @Transactional
    public CustomerResponse edit(Long id, CustomerRequest r) {
        var customer = customers.findLocked(id).orElseThrow(CustomerService::notFound);
        customer.edit(r.name(), r.documentType(), r.documentNumber(), r.phone(), r.email(), r.address(), r.notes());
        customers.flush(); return CustomerResponse.from(customer);
    }
    @Transactional @PreAuthorize("hasRole('ADMIN')")
    public CustomerResponse status(Long id, boolean active) {
        var customer = customers.findLocked(id).orElseThrow(CustomerService::notFound);
        customer.changeStatus(active); customers.flush(); return CustomerResponse.from(customer);
    }
    private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "Cliente no encontrado."); }
}
