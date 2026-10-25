package pe.com.fabrizio.cajalima.purchase;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PurchaseItemRepository extends JpaRepository<PurchaseItem,Long>{List<PurchaseItem> findByPurchaseIdOrderById(Long purchaseId);}
