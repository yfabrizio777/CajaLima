package pe.com.fabrizio.cajalima.sale.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.com.fabrizio.cajalima.sale.domain.SaleItem;
public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {
    List<SaleItem> findBySaleIdOrderById(Long saleId);
}
