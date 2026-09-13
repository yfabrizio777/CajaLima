package pe.com.fabrizio.cajalima.auth;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import pe.com.fabrizio.cajalima.auth.security.JwtService;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTests {
    private final String secret = randomSecret();
    private final JwtService service = new JwtService(secret, 3600000);

    private static String randomSecret() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private String sign(String signingSecret, JwtClaimsSet claims) {
        var key = new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        var encoder = NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), claims)).getTokenValue();
    }

    private JwtClaimsSet.Builder claims() {
        return JwtClaimsSet.builder().issuer("cajalima").subject("42").claim("role", "EMPLOYEE")
                .issuedAt(Instant.now().minusSeconds(5)).expiresAt(Instant.now().plusSeconds(60));
    }

    @Test
    void validTokenIdentifiesUser() {
        assertEquals(42, service.userId(sign(secret, claims().build())));
    }

    @Test
    void expiredTokenIsRejected() {
        String token = sign(secret, claims().issuedAt(Instant.now().minusSeconds(120))
                .expiresAt(Instant.now().minusSeconds(60)).build());
        assertThrows(JwtException.class, () -> service.userId(token));
    }

    @Test
    void wrongKeyIsRejected() {
        String token = sign(randomSecret(), claims().build());
        assertThrows(JwtException.class, () -> service.userId(token));
    }

    @Test
    void wrongIssuerIsRejected() {
        String token = sign(secret, claims().issuer("another-app").build());
        assertThrows(JwtException.class, () -> service.userId(token));
    }

    @Test
    void tokenWithoutExpirationIsRejected() {
        String token = sign(secret, JwtClaimsSet.builder().issuer("cajalima").subject("42")
                .claim("role", "ADMIN").issuedAt(Instant.now().minusSeconds(5)).build());
        assertThrows(JwtException.class, () -> service.userId(token));
    }

    @Test
    void futureIssuedAtIsRejected() {
        String token = sign(secret, claims().issuedAt(Instant.now().plusSeconds(30)).build());
        assertThrows(JwtException.class, () -> service.userId(token));
    }

    @Test
    void weakSecretAndInvalidExpiryFailAtStartup() {
        assertThrows(IllegalStateException.class, () -> new JwtService("", 3600000));
        assertThrows(IllegalStateException.class, () -> new JwtService(secret, 0));
    }
}
