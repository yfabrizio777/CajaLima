package pe.com.fabrizio.cajalima.sale.repository;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pe.com.fabrizio.cajalima.sale.domain.Sale;
public interface SaleRepository extends JpaRepository<Sale, Long> {
    Optional<Sale> findByRequestId(UUID requestId);
    Page<Sale> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant from, Instant to, Pageable page);
    interface Summary { BigDecimal getTotal(); long getCount(); }
    @Query("select coalesce(sum(s.total), 0) as total, count(s) as count from Sale s where s.createdAt >= :from and s.createdAt < :to")
    Summary summarize(@Param("from") Instant from, @Param("to") Instant to);
}
