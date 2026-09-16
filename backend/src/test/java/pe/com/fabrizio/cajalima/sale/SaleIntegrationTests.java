package pe.com.fabrizio.cajalima.sale;

import java.util.*;
import java.security.SecureRandom;
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
class SaleIntegrationTests {
    private static final String SCHEMA = "sale_test_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    private String admin;
    private String employee;
    private long actor;
    private long product;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.flyway.schemas", () -> SCHEMA);
        r.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        r.add("spring.datasource.hikari.schema", () -> SCHEMA);
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key);
        r.add("app.jwt.secret", () -> Base64.getEncoder().encodeToString(key));
        r.add("app.jwt.expiration", () -> 3600000);
    }
    @AfterAll static void cleanup(@Autowired JdbcTemplate jdbc) {
        if (!SCHEMA.matches("sale_test_[a-f0-9]{32}")) throw new IllegalStateException();
        jdbc.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
    }
    @BeforeEach void fixtures() {
        jdbc.update("delete from inventory_movements"); jdbc.update("delete from sale_items"); jdbc.update("delete from sales");
        jdbc.update("delete from products"); jdbc.update("delete from users");
        User owner = users.saveAndFlush(new User("Prueba", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.ADMIN));
        actor = owner.getId(); admin = jwt.issue(owner).token();
        employee = jwt.issue(users.saveAndFlush(new User("Colaborador", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.EMPLOYEE))).token();
        product = jdbc.queryForObject("insert into products(name,sale_price,stock,minimum_stock,active,created_at,updated_at) values ('Inca Kola 500 ml',3.50,24,5,true,now(),now()) returning id", Long.class);
    }
    private Map<String, Object> body(int quantity) {
        return new HashMap<>(Map.of("requestId", UUID.randomUUID().toString(), "paymentMethod", "YAPE", "items", List.of(Map.of("productId", product, "quantity", quantity))));
    }
    private ResultActions sell(String token, Object body) throws Exception {
        return mvc.perform(post("/api/sales").header("Authorization", "Bearer " + token).contentType("application/json").content(json.writeValueAsString(body)));
    }
    private int stock() { return jdbc.queryForObject("select stock from products where id=?", Integer.class, product); }
    private int count(String table) { return jdbc.queryForObject("select count(*) from " + table, Integer.class); }
    @Test void adminSaleRecalculatesAndDecrements() throws Exception {
        sell(admin, body(2)).andExpect(status().isCreated()).andExpect(jsonPath("total").value(7.0)).andExpect(jsonPath("items[0].unitPrice").value(3.5)).andExpect(jsonPath("createdBy").value(actor));
        assertEquals(22, stock()); assertEquals(1, count("sales")); assertEquals(1, count("sale_items"));
    }
    @Test void employeeCanSellAndRead() throws Exception {
        sell(employee, body(1)).andExpect(status().isCreated());
        mvc.perform(get("/api/sales").header("Authorization", "Bearer " + employee)).andExpect(status().isOk()).andExpect(jsonPath("total").value(1));
    }
    @Test void anonymousRejected() throws Exception {
        mvc.perform(post("/api/sales").contentType("application/json").content(json.writeValueAsString(body(1)))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/sales")).andExpect(status().isUnauthorized());
    }
    @Test void missingProductRejected() throws Exception {
        var b = body(1); b.put("items", List.of(Map.of("productId", 999999999, "quantity", 1)));
        sell(admin, b).andExpect(status().isNotFound()); assertEquals(0, count("sales"));
    }
    @Test void inactiveProductRejected() throws Exception {
        jdbc.update("update products set active=false where id=?", product);
        sell(admin, body(1)).andExpect(status().isConflict()); assertEquals(24, stock());
    }
    @Test void invalidQuantitiesRejected() throws Exception {
        for (int value : new int[] {0, -1, 1000001}) sell(admin, body(value)).andExpect(status().isBadRequest());
        assertEquals(24, stock()); assertEquals(0, count("sales"));
    }
    @Test void fractionalQuantityRejected() throws Exception {
        var b = body(1); b.put("items", List.of(Map.of("productId", product, "quantity", 1.5)));
        sell(admin, b).andExpect(status().isBadRequest());
    }
    @Test void insufficientStockDoesNotCreateSale() throws Exception {
        sell(admin, body(25)).andExpect(status().isConflict()); assertEquals(24, stock()); assertEquals(0, count("sales"));
    }
    @Test void movementReferencesSaleAndActor() throws Exception {
        sell(admin, body(2)).andExpect(status().isCreated());
        assertEquals(1, jdbc.queryForObject("select count(*) from inventory_movements m join sales s on m.sale_id=s.id where m.type='SALE' and m.product_id=? and m.previous_stock=24 and m.new_stock=22 and m.quantity=-2 and m.created_by=?", Integer.class, product, actor));
    }
    @Test void snapshotSurvivesProductChanges() throws Exception {
        String result = sell(admin, body(2)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = json.readTree(result).get("id").asLong();
        jdbc.update("update products set name='Otro nombre', sale_price=99 where id=?", product);
        mvc.perform(get("/api/sales/" + id).header("Authorization", "Bearer " + employee)).andExpect(status().isOk()).andExpect(jsonPath("items[0].productName").value("Inca Kola 500 ml")).andExpect(jsonPath("total").value(7.0));
    }
    @Test void massAssignmentRejected() throws Exception {
        for (String field : List.of("total", "createdBy", "role", "previousStock", "newStock")) {
            var b = body(1); b.put(field, 0); sell(admin, b).andExpect(status().isBadRequest());
        }
        var b = body(1); b.put("items", List.of(Map.of("productId", product, "quantity", 1, "unitPrice", 0)));
        sell(admin, b).andExpect(status().isBadRequest()); assertEquals(0, count("sales"));
    }
    @Test void emptyAndDuplicateItemsRejected() throws Exception {
        var b = body(1); b.put("items", List.of()); sell(admin, b).andExpect(status().isBadRequest());
        b.put("items", List.of(Map.of("productId", product, "quantity", 1), Map.of("productId", product, "quantity", 1)));
        sell(admin, b).andExpect(status().isBadRequest());
    }
    @Test void invalidPaymentRejected() throws Exception { var b = body(1); b.put("paymentMethod", "CARD"); sell(admin, b).andExpect(status().isBadRequest()); }
    @Test void allManualPaymentMethodsWork() throws Exception {
        for (String method : List.of("CASH","YAPE","PLIN","TRANSFER")) { var b = body(1); b.put("paymentMethod", method); sell(employee, b).andExpect(status().isCreated()).andExpect(jsonPath("paymentMethod").value(method)); }
    }
    @Test void retryDoesNotDuplicateSale() throws Exception {
        var b = body(2); sell(admin, b).andExpect(status().isCreated()); sell(admin, b).andExpect(status().isCreated());
        assertEquals(1, count("sales")); assertEquals(22, stock());
        b.put("paymentMethod", "CASH"); sell(admin, b).andExpect(status().isConflict());
    }
    @Test void differentActorCannotReuseRequestReference() throws Exception {
        var b = body(1); sell(admin, b).andExpect(status().isCreated()); sell(employee, b).andExpect(status().isConflict());
    }
    @Test void concurrentLastUnitOnlyConfirmsOne() throws Exception {
        jdbc.update("update products set stock=1 where id=?", product);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var a = executor.submit(() -> { start.await(); return sell(admin, body(1)).andReturn().getResponse().getStatus(); });
            var b = executor.submit(() -> { start.await(); return sell(employee, body(1)).andReturn().getResponse().getStatus(); });
            start.countDown();
            var statuses = new ArrayList<>(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))); Collections.sort(statuses);
            assertEquals(List.of(201,409), statuses); assertEquals(0, stock()); assertEquals(1, count("sales")); assertEquals(1, count("inventory_movements"));
        }
    }
    @Test void concurrentRetryDoesNotDuplicate() throws Exception {
        var request = body(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var a = executor.submit(() -> { start.await(); return sell(admin, request).andReturn().getResponse().getStatus(); });
            var b = executor.submit(() -> { start.await(); return sell(admin, request).andReturn().getResponse().getStatus(); });
            start.countDown(); assertEquals(201, a.get(15, TimeUnit.SECONDS)); assertEquals(201, b.get(15, TimeUnit.SECONDS));
            assertEquals(1, count("sales")); assertEquals(22, stock());
        }
    }
    @Test void databaseFailureAfterSaleAndItemRollsBackEverything() throws Exception {
        jdbc.execute("create function fail_sale_movement() returns trigger language plpgsql as $$ begin raise exception 'Forced test failure'; end $$");
        jdbc.execute("create trigger test_failure before insert on inventory_movements for each row execute function fail_sale_movement()");
        try {
            sell(admin, body(2)).andExpect(status().isInternalServerError());
            assertEquals(24, stock()); assertEquals(0, count("sales")); assertEquals(0, count("sale_items")); assertEquals(0, count("inventory_movements"));
        } finally { jdbc.execute("drop trigger test_failure on inventory_movements"); jdbc.execute("drop function fail_sale_movement()"); }
    }
    @Test void listPaginationAndMissingSale() throws Exception {
        sell(admin, body(1)); sell(admin, body(2));
        mvc.perform(get("/api/sales?size=1&page=1").header("Authorization", "Bearer " + employee)).andExpect(status().isOk()).andExpect(jsonPath("total").value(2)).andExpect(jsonPath("items.length()").value(1));
        mvc.perform(get("/api/sales/999999999").header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound());
    }
    @Test void summaryUsesPeruvianDay() throws Exception {
        sell(admin, body(2));
        var day = java.time.LocalDate.now(java.time.ZoneId.of("America/Lima"));
        mvc.perform(get("/api/sales/summary").header("Authorization", "Bearer " + admin)).andExpect(jsonPath("count").value(1)).andExpect(jsonPath("total").value(7.0)).andExpect(jsonPath("date").value(day.toString()));
        jdbc.update("update sales set created_at=?", java.sql.Timestamp.from(day.atStartOfDay(java.time.ZoneId.of("America/Lima")).toInstant().minusSeconds(1)));
        mvc.perform(get("/api/sales/summary").header("Authorization", "Bearer " + admin)).andExpect(jsonPath("count").value(0)).andExpect(jsonPath("total").value(0));
    }
}
