package pe.com.fabrizio.cajalima.auth.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import pe.com.fabrizio.cajalima.auth.dto.LoginResponse;
import pe.com.fabrizio.cajalima.user.domain.User;

@Service
public class JwtService {
    private static final String ISSUER = "cajalima";
    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final long expirationSeconds;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration}") long expirationMillis) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (secret.isBlank() || keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET debe contener al menos 32 bytes UTF-8 aleatorios.");
        }
        if (expirationMillis < 1000 || expirationMillis > 86400000) {
            throw new IllegalStateException("JWT_EXPIRATION debe estar entre 1000 y 86400000 milisegundos.");
        }
        var key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.encoder = NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build();
        var jwtDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        jwtDecoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(ISSUER)));
        this.decoder = jwtDecoder;
        this.expirationSeconds = expirationMillis / 1000;
    }

    public LoginResponse issue(User user) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(ISSUER).subject(user.getId().toString())
                .claim("role", user.getRole().name()).issuedAt(now)
                .expiresAt(now.plusSeconds(expirationSeconds)).build();
        var header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new LoginResponse(token, "Bearer", expirationSeconds);
    }

    public long userId(String token) {
        Jwt jwt = decoder.decode(token);
        // Require our claims explicitly; a signed token without expiration is not accepted.
        if (jwt.getExpiresAt() == null || jwt.getIssuedAt() == null
                || !jwt.getExpiresAt().isAfter(Instant.now())
                || jwt.getIssuedAt().isAfter(Instant.now())
                || !jwt.getExpiresAt().isAfter(jwt.getIssuedAt())
                || !("ADMIN".equals(jwt.getClaimAsString("role"))
                    || "EMPLOYEE".equals(jwt.getClaimAsString("role")))) {
            throw new BadJwtException("Token inválido.");
        }
        try {
            long id = Long.parseLong(jwt.getSubject());
            if (id <= 0) { throw new NumberFormatException(); }
            return id;
        } catch (NumberFormatException ex) {
            throw new BadJwtException("Token inválido.");
        }
    }
}
