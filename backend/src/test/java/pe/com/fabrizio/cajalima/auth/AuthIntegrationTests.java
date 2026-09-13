package pe.com.fabrizio.cajalima.auth;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.security.SecureRandom;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("local")
@SpringBootTest(properties = "spring.docker.compose.skip.in-tests=false")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AuthIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;

    @DynamicPropertySource
    static void jwtProperties(DynamicPropertyRegistry registry) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String secret = Base64.getEncoder().encodeToString(bytes);
        registry.add("app.jwt.secret", () -> secret);
        registry.add("app.jwt.expiration", () -> 3600000);
    }

    private final String email = UUID.randomUUID() + "@example.com";
    private final String password = UUID.randomUUID().toString();

    private String registration(String address) {
        return json.writeValueAsString(Map.of("name", "Persona de prueba", "email", address,
                "password", password, "role", "EMPLOYEE"));
    }

    private void register() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json").content(registration(email)))
                .andExpect(status().isCreated());
    }

    private String login(String address, String submittedPassword) {
        return json.writeValueAsString(Map.of("email", address, "password", submittedPassword));
    }

    private String token() throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
                        .content(login(email, password)))
                .andExpect(status().isOk()).andExpect(jsonPath("type").value("Bearer"))
                .andExpect(jsonPath("expiresIn").value(3600))
                .andExpect(jsonPath("password_hash").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void registerNormalizesEmailAndStoresOnlyBcrypt() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content(registration("  " + email.toUpperCase(java.util.Locale.ROOT) + "  ")))
                .andExpect(status().isCreated()).andExpect(jsonPath("email").value(email))
                .andExpect(jsonPath("role").value("EMPLOYEE")).andExpect(jsonPath("active").value(true))
                .andExpect(jsonPath("password").doesNotExist())
                .andExpect(jsonPath("passwordHash").doesNotExist())
                .andExpect(jsonPath("password_hash").doesNotExist());
        String hash = jdbc.queryForObject("select password_hash from users where email = ?", String.class, email);
        assertTrue(hash != null && hash.startsWith("$2"), "Must store BCrypt");
        assertTrue(new BCryptPasswordEncoder().matches(password, hash), "Hash must match input");
    }

    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        register();
        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content(registration(email.toUpperCase(java.util.Locale.ROOT))))
                .andExpect(status().isConflict()).andExpect(jsonPath("status").value(409));
    }

    @Test
    void correctLoginIssuesToken() throws Exception {
        register();
        assertTrue(token().split("\\.").length == 3, "JWT must have three segments");
    }

    @Test
    void wrongPasswordAndUnknownEmailUseSameMessage() throws Exception {
        register();
        String known = mvc.perform(post("/api/auth/login").contentType("application/json")
                        .content(login(email, UUID.randomUUID().toString())))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        String unknown = mvc.perform(post("/api/auth/login").contentType("application/json")
                        .content(login("unknown-" + email, password)))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        assertEquals(json.readTree(known).get("message"), json.readTree(unknown).get("message"));
    }

    @Test
    void meWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("status").value(401));
    }

    @Test
    void meWithTokenReturnsOnlyPublicUserFields() throws Exception {
        register();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token()))
                .andExpect(status().isOk()).andExpect(jsonPath("email").value(email))
                .andExpect(jsonPath("password").doesNotExist())
                .andExpect(jsonPath("passwordHash").doesNotExist())
                .andExpect(jsonPath("password_hash").doesNotExist());
    }

    @Test
    void inactiveUserCannotLoginOrReuseToken() throws Exception {
        register();
        String token = token();
        jdbc.update("update users set active = false where email = ?", email);
        entityManager.clear();
        mvc.perform(post("/api/auth/login").contentType("application/json").content(login(email, password)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void malformedTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("status").value(401));
    }

    @Test
    void invalidRoleAndOversizedBcryptPasswordAreBadRequests() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content(registration(email).replace("EMPLOYEE", "OWNER")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content(json.writeValueAsString(Map.of("name", "Prueba", "email", email,
                                "password", "á".repeat(40), "role", "EMPLOYEE"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void publicRegistrationAllowsAdminButDoesNotBindInternalFields() throws Exception {
        String input = json.writeValueAsString(Map.of("name", "Prueba", "email", email,
                "password", password, "role", "ADMIN", "active", false, "id", -99));
        mvc.perform(post("/api/auth/register").contentType("application/json").content(input))
                .andExpect(status().isCreated()).andExpect(jsonPath("role").value("ADMIN"))
                .andExpect(jsonPath("active").value(true))
                .andExpect(jsonPath("id").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void missingFieldsAndShortPasswordAreRejected() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType("application/json")
                        .content(registration(email).replace(password, "short")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tokenIsRequiredOnEveryRequestAndCurrentRoleComesFromDatabase() throws Exception {
        register();
        String token = token();
        jdbc.update("update users set role = 'ADMIN' where email = ?", email);
        entityManager.clear();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("role").value("ADMIN"))
                .andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void modifiedSignatureIsRejectedOverHttp() throws Exception {
        register();
        String token = token();
        int signatureStart = token.lastIndexOf('.') + 1;
        char replacement = token.charAt(signatureStart) == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, signatureStart) + replacement + token.substring(signatureStart + 1);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
    }
}
