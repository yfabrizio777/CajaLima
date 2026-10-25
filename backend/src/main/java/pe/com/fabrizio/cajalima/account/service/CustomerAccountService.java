package pe.com.fabrizio.cajalima.account.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import pe.com.fabrizio.cajalima.account.domain.*;
import pe.com.fabrizio.cajalima.account.dto.*;
import pe.com.fabrizio.cajalima.account.repository.AccountMovementRepository;
import pe.com.fabrizio.cajalima.customer.domain.Customer;
import pe.com.fabrizio.cajalima.customer.repository.CustomerRepository;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;
import pe.com.fabrizio.cajalima.user.repository.UserRepository;

@Service @Transactional(readOnly=true)
@PreAuthorize("hasAnyRole('ADMIN','EMPLOYEE')")
public class CustomerAccountService {
    private final AccountMovementRepository movements;
    private final CustomerRepository customers;
    private final UserRepository users;
    public CustomerAccountService(AccountMovementRepository movements,CustomerRepository customers,UserRepository users){this.movements=movements;this.customers=customers;this.users=users;}
    public record Account(Long customerId,String customerName,String outstandingBalance,String totalCredit,String totalPaid,Instant lastMovementAt){
        @Override public String toString(){return "Account[redacted]";}
    }
    public Account account(Long customerId){
        var customer=customers.findById(customerId).orElseThrow(CustomerAccountService::notFound);
        var totals=movements.totals(customerId);
        return new Account(customerId,customer.getName(),totals.getTotalCredit().subtract(totals.getTotalPaid()).setScale(2).toPlainString(),totals.getTotalCredit().setScale(2).toPlainString(),totals.getTotalPaid().setScale(2).toPlainString(),totals.getLastMovementAt());
    }
    public record MovementPage(List<AccountMovementResponse> items,long total,int page,int size){}
    public MovementPage list(Long customerId,int page,int size){
        if(page<0||page>100000||size<1||size>100)throw error(HttpStatus.BAD_REQUEST,"Revisa la página solicitada.");
        if(!customers.existsById(customerId))throw notFound();
        var result=movements.movements(customerId,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"createdAt","id")));
        return new MovementPage(result.getContent(),result.getTotalElements(),page,size);
    }
    // Called only by the sale transaction. The composite database FK checks the server-supplied sale tuple.
    @Transactional(propagation=Propagation.MANDATORY)
    public void recordCredit(Long customerId,Long saleId,BigDecimal amount,Long actor){
        var customer=lockedActive(customerId);
        movements.saveAndFlush(AccountMovement.credit(customer.getId(),saleId,amount,actor));
    }
    @Transactional
    public AccountMovementResponse pay(Long customerId,PaymentRequest request,Long actor){
        String fingerprint=fingerprint(customerId,request);
        var previous=movements.findByRequestId(request.requestId());
        if(previous.isPresent())return replay(previous.get(),actor,fingerprint);
        Customer customer=customers.findLocked(customerId).orElseThrow(CustomerAccountService::notFound);
        previous=movements.findByRequestId(request.requestId());
        if(previous.isPresent())return replay(previous.get(),actor,fingerprint);
        if(!customer.isActive())throw error(HttpStatus.CONFLICT,"El cliente seleccionado no está activo.");
        var totals=movements.totals(customerId);
        var balance=totals.getTotalCredit().subtract(totals.getTotalPaid());
        if(request.amount().compareTo(balance)>0)throw error(HttpStatus.CONFLICT,"El pago supera el saldo pendiente del cliente.");
        var movement=movements.saveAndFlush(AccountMovement.payment(customerId,request.amount(),request.paymentMethod(),request.note(),actor,request.requestId(),fingerprint));
        return response(movement);
    }
    private Customer lockedActive(Long id){var c=customers.findLocked(id).orElseThrow(CustomerAccountService::notFound);if(!c.isActive())throw error(HttpStatus.CONFLICT,"El cliente seleccionado no está activo.");return c;}
    private AccountMovementResponse replay(AccountMovement movement,Long actor,String fingerprint){
        if(!movement.getCreatedBy().equals(actor)||!movement.getRequestFingerprint().equals(fingerprint))throw error(HttpStatus.CONFLICT,"Esta referencia ya corresponde a otro pago. Revisa los movimientos.");
        return response(movement);
    }
    private AccountMovementResponse response(AccountMovement m){return AccountMovementResponse.from(m,users.getReferenceById(m.getCreatedBy()).getName());}
    private String fingerprint(Long customerId,PaymentRequest r){
        // A length-delimited final note cannot collide with the preceding fixed fields.
        String note=r.note()==null?"":r.note();
        String canonical=customerId+":"+r.amount().setScale(2).toPlainString()+":"+r.paymentMethod().name()+":"+note.length()+":"+note;
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException ex){throw new IllegalStateException("SHA-256 unavailable",ex);}
    }
    private static ApiException notFound(){return error(HttpStatus.NOT_FOUND,"Cliente no encontrado.");}
    private static ApiException error(HttpStatus status,String message){return new ApiException(status,message);}
}
