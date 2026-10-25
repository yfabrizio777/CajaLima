package pe.com.fabrizio.cajalima.account.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pe.com.fabrizio.cajalima.account.domain.AccountMovement;
import pe.com.fabrizio.cajalima.account.dto.AccountMovementResponse;

public interface AccountMovementRepository extends JpaRepository<AccountMovement,Long> {
    Optional<AccountMovement> findByRequestId(UUID requestId);
    interface Totals { BigDecimal getTotalCredit(); BigDecimal getTotalPaid(); Instant getLastMovementAt(); }
    @Query("select coalesce(sum(case when m.type=pe.com.fabrizio.cajalima.account.domain.AccountMovement$Type.CREDIT then m.amount else 0 end),0) as totalCredit, coalesce(sum(case when m.type=pe.com.fabrizio.cajalima.account.domain.AccountMovement$Type.PAYMENT then m.amount else 0 end),0) as totalPaid, max(m.createdAt) as lastMovementAt from AccountMovement m where m.customerId=:customerId")
    Totals totals(@Param("customerId")Long customerId);
    @Query("select new pe.com.fabrizio.cajalima.account.dto.AccountMovementResponse(m.id,m.customerId,m.saleId,m.type,m.amount,m.paymentMethod,m.note,m.createdBy,u.name,m.createdAt) from AccountMovement m, User u where u.id=m.createdBy and m.customerId=:customerId")
    Page<AccountMovementResponse> movements(@Param("customerId")Long customerId,Pageable page);
}
