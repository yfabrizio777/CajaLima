package pe.com.fabrizio.cajalima.auth.security;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
import pe.com.fabrizio.cajalima.user.repository.UserRepository;

// Constructed only inside the security chain, never registered as a second servlet filter.
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;
    private final SecurityErrorHandler errors;

    public JwtAuthenticationFilter(JwtService jwt, UserRepository users, SecurityErrorHandler errors) {
        this.jwt = jwt;
        this.users = users;
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        List<String> headers = Collections.list(request.getHeaders("Authorization"));
        if (headers.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }
        String header = headers.getFirst();
        if (headers.size() != 1 || header.length() > 4096
                || !header.matches("(?i)Bearer [A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+")) {
            errors.write(response, 401, "Autenticación requerida o token inválido.");
            return;
        }
        long userId;
        try {
            userId = jwt.userId(header.substring(7));
        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
            errors.write(response, 401, "Autenticación requerida o token inválido.");
            return;
        }
        // The database is authoritative for current role and active status.
        try {
            var user = users.findById(userId);
            if (user.isEmpty()) {
                errors.write(response, 401, "Autenticación requerida o token inválido.");
                return;
            }
            if (!user.get().isActive()) {
                errors.write(response, 403, "No tienes permiso para esta operación.");
                return;
            }
            var authentication = UsernamePasswordAuthenticationToken.authenticated(
                    UserResponse.from(user.get()), null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.get().getRole().name())));
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
        } catch (org.springframework.dao.DataAccessException ex) {
            errors.write(response, 500, "No pudimos procesar la solicitud.");
            return;
        }
        chain.doFilter(request, response);
    }
}
