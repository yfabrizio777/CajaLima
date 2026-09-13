package pe.com.fabrizio.cajalima.user.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;
import pe.com.fabrizio.cajalima.user.domain.User;
import pe.com.fabrizio.cajalima.user.domain.UserRole;
import pe.com.fabrizio.cajalima.user.dto.CreateUserRequest;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
import pe.com.fabrizio.cajalima.user.repository.UserRepository;

@Service
public class UserService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;

    public UserService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc) {
        this.users = users;
        this.passwords = passwords;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public boolean setupAvailable() { return users.count() == 0; }

    @Transactional
    public UserResponse registerOwner(CreateUserRequest request) {
        // An empty table has no row to lock. This transaction-scoped PostgreSQL lock
        // serializes the count + insert across all application instances.
        jdbc.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
        if (users.count() != 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "La configuración inicial ya fue realizada. Inicia sesión.");
        }
        return create(request, UserRole.ADMIN);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public UserResponse createEmployee(CreateUserRequest request) {
        return create(request, UserRole.EMPLOYEE);
    }

    private UserResponse create(CreateUserRequest request, UserRole role) {
        if (users.existsByEmail(request.email())) { throw duplicateEmail(); }
        User user = new User(request.name(), request.email(), passwords.encode(request.password()), role);
        try {
            return UserResponse.from(users.saveAndFlush(user));
        } catch (DataIntegrityViolationException ex) {
            Throwable cause = ex;
            while (cause != null) {
                if (cause instanceof org.hibernate.exception.ConstraintViolationException violation
                        && "users_email_key".equals(violation.getConstraintName())) {
                    throw duplicateEmail();
                }
                cause = cause.getCause();
            }
            throw ex;
        }
    }

    private ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "El correo ya se encuentra registrado.");
    }
}
