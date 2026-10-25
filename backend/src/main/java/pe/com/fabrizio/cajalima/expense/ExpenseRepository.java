package pe.com.fabrizio.cajalima.expense;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ExpenseRepository extends JpaRepository<Expense,Long>,JpaSpecificationExecutor<Expense>{
    Optional<Expense> findByRequestId(UUID requestId);
    @Query("select coalesce(sum(e.amount),0) from Expense e where e.expenseDate=:date") BigDecimal total(@Param("date") LocalDate date);
}
