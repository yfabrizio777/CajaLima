package pe.com.fabrizio.cajalima.customer;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.ObjectMapper;
import pe.com.fabrizio.cajalima.auth.security.JwtService;
import pe.com.fabrizio.cajalima.user.domain.*;
import pe.com.fabrizio.cajalima.user.repository.UserRepository;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("local")
@SpringBootTest(properties = "spring.docker.compose.skip.in-tests=false")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
class CustomerIntegrationTests {
    private static final String SCHEMA = "customer_test_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    private String admin;
    private String employee;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.flyway.schemas", () -> SCHEMA);
        r.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        r.add("spring.datasource.hikari.schema", () -> SCHEMA);
        r.add("app.jwt.secret", () -> UUID.randomUUID().toString() + UUID.randomUUID());
        r.add("app.jwt.expiration", () -> 3600000);
    }
    @AfterAll static void cleanup(@Autowired JdbcTemplate jdbc) {
        if (!SCHEMA.matches("customer_test_[a-f0-9]{32}")) throw new IllegalStateException();
        jdbc.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
    }
    @BeforeEach void fixtures() {
        admin = jwt.issue(users.saveAndFlush(new User("Admin", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.ADMIN))).token();
        employee = jwt.issue(users.saveAndFlush(new User("Empleado", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.EMPLOYEE))).token();
    }
    private Map<String, Object> basic() { return new HashMap<>(Map.of("name", "María Quispe")); }
    private Map<String, Object> documented(String type, String number) {
        var body = basic(); body.put("documentType", type); body.put("documentNumber", number); return body;
    }
    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder, String token, Object body) throws Exception {
        builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType("application/json").content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }
    private long create(Object body) throws Exception {
        var result = send(post("/api/customers"), admin, body).andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void createsMinimalCustomerActiveByDefault() throws Exception {
        send(post("/api/customers"), admin, basic()).andExpect(status().isCreated())
                .andExpect(jsonPath("name").value("María Quispe")).andExpect(jsonPath("active").value(true))
                .andExpect(jsonPath("documentNumber").isEmpty()).andExpect(jsonPath("createdAt").isNotEmpty());
    }
    @Test void employeeCreatesReadsAndEditsBasicData() throws Exception {
        var result = send(post("/api/customers"), employee, basic()).andExpect(status().isCreated()).andReturn();
        long id = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        var body = basic(); body.put("name", "María Actualizada"); body.put("notes", "Entregar por la tarde");
        send(put("/api/customers/" + id), employee, body).andExpect(status().isOk()).andExpect(jsonPath("notes").value("Entregar por la tarde"));
        send(get("/api/customers/" + id), employee, null).andExpect(status().isOk()).andExpect(jsonPath("name").value("María Actualizada"));
    }
    @Test void anonymousCannotAccessAnyOperation() throws Exception {
        for (var method : List.of(get("/api/customers"), get("/api/customers/1"), post("/api/customers"), put("/api/customers/1"), patch("/api/customers/1/status")))
            mvc.perform(method).andExpect(status().isUnauthorized());
    }
    @Test void employeeCannotChangeStatusAndAdminCanReactivate() throws Exception {
        long id = create(basic());
        send(patch("/api/customers/" + id + "/status"), employee, Map.of("active", false)).andExpect(status().isForbidden());
        send(patch("/api/customers/" + id + "/status"), admin, Map.of("active", false)).andExpect(status().isOk()).andExpect(jsonPath("active").value(false));
        send(put("/api/customers/" + id), employee, basic()).andExpect(status().isOk()).andExpect(jsonPath("active").value(false));
        send(patch("/api/customers/" + id + "/status"), admin, Map.of("active", true)).andExpect(status().isOk()).andExpect(jsonPath("active").value(true));
    }
    @Test void normalizesWhitespaceCaseAndContact() throws Exception {
        var body = documented("CE", " ab 12-34 "); body.put("name", "  María   Quispe  ");
        body.put("email", "  FAMILIA@EXAMPLE.COM "); body.put("phone", "+51 (999) 888-777");
        send(post("/api/customers"), admin, body).andExpect(status().isCreated())
                .andExpect(jsonPath("name").value("María Quispe")).andExpect(jsonPath("documentNumber").value("AB12-34"))
                .andExpect(jsonPath("email").value("familia@example.com")).andExpect(jsonPath("phone").value("+51999888777"));
    }
    @Test void optionalBlanksBecomeNullAndUntypedDocumentUsesOther() throws Exception {
        var body = basic(); body.put("phone", "  "); body.put("email", " "); body.put("notes", " "); body.put("documentNumber", "manual 123");
        send(post("/api/customers"), admin, body).andExpect(status().isCreated()).andExpect(jsonPath("phone").isEmpty())
                .andExpect(jsonPath("email").isEmpty()).andExpect(jsonPath("notes").isEmpty()).andExpect(jsonPath("documentType").value("OTHER"));
    }
    @Test void duplicateDocumentIsRejectedIncludingInactiveCustomer() throws Exception {
        String number = UUID.randomUUID().toString().substring(0, 8);
        long id = create(documented("OTHER", number));
        send(patch("/api/customers/" + id + "/status"), admin, Map.of("active", false)).andExpect(status().isOk());
        send(post("/api/customers"), employee, documented("OTHER", " " + number.toUpperCase(Locale.ROOT) + " ")).andExpect(status().isConflict());
        create(documented("CE", number));
    }
    @Test void sharedEmailAndMissingDocumentsAreAllowed() throws Exception {
        var body = basic(); body.put("email", "familia@example.com"); create(body); create(body);
    }
    @Test void validatesDocumentFormatsWithoutOfficialLookup() throws Exception {
        create(documented("DNI", "12345678")); create(documented("RUC", "20123456789"));
        for (var body : List.of(documented("DNI", "1234567"), documented("RUC", "ABC"), documented("CE", "<>"), documented("OTHER", "x".repeat(33)), documented("PASSPORT", "123")))
            send(post("/api/customers"), admin, body).andExpect(status().isBadRequest());
    }
    @Test void validatesLengthsNameEmailAndPhone() throws Exception {
        for (var entry : Map.of("name", " ", "email", "bad-address", "phone", "not-a-phone", "address", "x".repeat(241), "notes", "x".repeat(1001)).entrySet()) {
            var body = basic(); body.put(entry.getKey(), entry.getValue());
            send(post("/api/customers"), admin, body).andExpect(status().isBadRequest());
        }
    }
    @Test void pagesHaveStableOrderAndEditCanClearOptionalData() throws Exception {
        String prefix = "Pagina " + UUID.randomUUID();
        var first = basic(); first.put("name", prefix + " A"); first.put("phone", "999888111");
        long id = create(first);
        var second = basic(); second.put("name", prefix + " B"); create(second);
        send(get("/api/customers").param("search", prefix).param("size", "1").param("page", "0"), admin, null)
                .andExpect(status().isOk()).andExpect(jsonPath("total").value(2)).andExpect(jsonPath("items[0].name").value(prefix + " A"));
        send(get("/api/customers").param("search", prefix).param("size", "1").param("page", "1"), employee, null)
                .andExpect(status().isOk()).andExpect(jsonPath("items[0].name").value(prefix + " B"));
        send(put("/api/customers/" + id), employee, basic()).andExpect(status().isOk()).andExpect(jsonPath("phone").isEmpty());
        var tooLong = basic(); tooLong.put("name", "x".repeat(161));
        send(post("/api/customers"), admin, tooLong).andExpect(status().isBadRequest());
    }
    @Test void rejectsMassAssignmentOnCreateAndEdit() throws Exception {
        long id = create(basic());
        for (String key : List.of("active", "id", "createdAt", "role")) {
            var body = basic(); body.put(key, "spoofed");
            send(post("/api/customers"), employee, body).andExpect(status().isBadRequest());
            send(put("/api/customers/" + id), employee, body).andExpect(status().isBadRequest());
        }
        send(patch("/api/customers/" + id + "/status"), admin, Map.of()).andExpect(status().isBadRequest());
    }
    @Test void searchIsLiteralCaseInsensitiveAndPaginated() throws Exception {
        String name = "Busqueda " + UUID.randomUUID();
        var body = documented("OTHER", UUID.randomUUID().toString().substring(0, 8)); body.put("name", name); body.put("phone", "987 654 321");
        create(body);
        for (String term : List.of(name.toLowerCase(Locale.ROOT), body.get("documentNumber").toString(), "987654321"))
            send(get("/api/customers").param("search", term).param("size", "1"), employee, null)
                    .andExpect(status().isOk()).andExpect(jsonPath("items[0].name").value(name)).andExpect(jsonPath("size").value(1));
        for (String term : List.of("%", "_", "' OR 1=1 --"))
            send(get("/api/customers").param("search", term), admin, null).andExpect(status().isOk()).andExpect(jsonPath("total").value(0));
    }
    @Test void boundsPaginationAndSearch() throws Exception {
        for (var params : List.of(Map.of("page", "-1"), Map.of("size", "0"), Map.of("size", "101"), Map.of("search", "x".repeat(161))))
            for (var entry : params.entrySet()) send(get("/api/customers").param(entry.getKey(), entry.getValue()), admin, null).andExpect(status().isBadRequest());
    }
    @Test void missingCustomerIs404AndPhysicalDeleteIsUnavailable() throws Exception {
        send(get("/api/customers/999999999"), admin, null).andExpect(status().isNotFound());
        send(put("/api/customers/999999999"), admin, basic()).andExpect(status().isNotFound());
        send(patch("/api/customers/999999999/status"), admin, Map.of("active", false)).andExpect(status().isNotFound());
        long id = create(basic());
        send(delete("/api/customers/" + id), admin, null).andExpect(status().isMethodNotAllowed());
        send(get("/api/customers/" + id), admin, null).andExpect(status().isOk());
    }
    @Test void editKeepsIdentityAndOriginalCreationAndDetectsDuplicate() throws Exception {
        String number = UUID.randomUUID().toString().substring(0, 8);
        long first = create(documented("OTHER", number)); long second = create(basic());
        var before = send(get("/api/customers/" + first), admin, null).andReturn().getResponse().getContentAsString();
        var after = send(put("/api/customers/" + first), employee, documented("OTHER", number)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(json.readTree(before).get("createdAt"), json.readTree(after).get("createdAt"));
        send(put("/api/customers/" + second), admin, documented("OTHER", number)).andExpect(status().isConflict());
    }
    @Test void databaseUniquenessResolvesConcurrentCreates() throws Exception {
        var body = documented("OTHER", UUID.randomUUID().toString().substring(0, 8));
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> task = () -> { ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); return send(post("/api/customers"), employee, body).andReturn().getResponse().getStatus(); };
            var a = pool.submit(task); var b = pool.submit(task); assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(List.of(201, 409), java.util.stream.Stream.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)).sorted().toList());
        }
    }
}
