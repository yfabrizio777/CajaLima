package pe.com.fabrizio.cajalima;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("local")
@SpringBootTest(properties = "spring.docker.compose.skip.in-tests=false")
class CajalimaApplicationTests {

	@Test
	void contextLoads() {
	}

}
