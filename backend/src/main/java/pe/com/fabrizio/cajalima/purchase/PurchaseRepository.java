package pe.com.fabrizio.cajalima.purchase;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface PurchaseRepository extends JpaRepository<Purchase,Long>,JpaSpecificationExecutor<Purchase>{
    Optional<Purchase> findByRequestId(UUID requestId);
    @Query("select coalesce(sum(p.total),0) from Purchase p where p.purchaseDate=:date") BigDecimal total(@Param("date") LocalDate date);
}
