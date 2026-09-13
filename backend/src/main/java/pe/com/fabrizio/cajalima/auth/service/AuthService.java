package pe.com.fabrizio.cajalima.auth.service;

import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.com.fabrizio.cajalima.auth.dto.*;
import pe.com.fabrizio.cajalima.auth.security.JwtService;
import pe.com.fabrizio.cajalima.shared.exception.ApiException;
import pe.com.fabrizio.cajalima.user.domain.User;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
import pe.com.fabrizio.cajalima.user.repository.UserRepository;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder passwords, JwtService jwt) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        // Do comparable BCrypt work even if the email does not exist.
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (users.existsByEmail(request.email())) { throw duplicateEmail(); }
        User user = new User(request.name(), request.email(), passwords.encode(request.password()), request.role());
        try {
            return UserResponse.from(users.saveAndFlush(user));
        } catch (DataIntegrityViolationException ex) {
            // The database's unique constraint also protects simultaneous registrations.
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

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        var user = users.findByEmail(request.email());
        boolean matches = passwords.matches(request.password(), user.map(User::getPasswordHash).orElse(dummyHash));
        if (user.isEmpty() || !matches) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos.");
        }
        if (!user.get().isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "No tienes permiso para esta operación.");
        }
        return jwt.issue(user.get());
    }

    private ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "El correo ya se encuentra registrado.");
    }
}
