package pe.com.fabrizio.cajalima.user.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.com.fabrizio.cajalima.user.domain.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
