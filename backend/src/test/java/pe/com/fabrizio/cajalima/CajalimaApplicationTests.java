package pe.com.fabrizio.cajalima;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@ActiveProfiles("local")
@SpringBootTest(properties = "spring.docker.compose.skip.in-tests=false")
class CajalimaApplicationTests {

	@DynamicPropertySource
	static void jwtProperties(DynamicPropertyRegistry registry) {
		byte[] bytes = new byte[32];
		new java.security.SecureRandom().nextBytes(bytes);
		String secret = java.util.Base64.getEncoder().encodeToString(bytes);
		registry.add("app.jwt.secret", () -> secret);
		registry.add("app.jwt.expiration", () -> 3600000);
	}

	@Test
	void contextLoads() {
	}

}
