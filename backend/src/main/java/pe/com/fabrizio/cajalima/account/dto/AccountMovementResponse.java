package pe.com.fabrizio.cajalima.account.dto;

import java.math.BigDecimal;
import java.time.Instant;
import pe.com.fabrizio.cajalima.account.domain.*;

public record AccountMovementResponse(Long id,Long customerId,Long saleId,AccountMovement.Type type,BigDecimal amount,
        AccountPaymentMethod paymentMethod,String note,Long createdBy,String createdByName,Instant createdAt) {
    public static AccountMovementResponse from(AccountMovement m,String name){return new AccountMovementResponse(m.getId(),m.getCustomerId(),m.getSaleId(),m.getType(),m.getAmount(),m.getPaymentMethod(),m.getNote(),m.getCreatedBy(),name,m.getCreatedAt());}
    @Override public String toString(){return "AccountMovementResponse[redacted]";}
}
