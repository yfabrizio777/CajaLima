package pe.com.fabrizio.cajalima.product.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.com.fabrizio.cajalima.product.domain.InventoryMovement;
public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> { }
