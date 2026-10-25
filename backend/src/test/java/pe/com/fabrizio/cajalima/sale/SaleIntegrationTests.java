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
        jdbc.update("delete from products"); jdbc.update("delete from customers"); jdbc.update("delete from users");
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
    private long customer(String name) throws Exception {
        var result = mvc.perform(post("/api/customers").header("Authorization", "Bearer " + admin)
                .contentType("application/json").content(json.writeValueAsString(Map.of("name", name))))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    private Map<String, Object> associated(long id, int quantity) {
        var request = body(quantity); request.put("customerId", id); return request;
    }
    @Test void generalPublicSaleExplicitlyReturnsNullCustomer() throws Exception {
        var result = sell(admin, body(1)).andExpect(status().isCreated()).andReturn();
        var response = json.readTree(result.getResponse().getContentAsString());
        assertTrue(response.has("customer")); assertTrue(response.get("customer").isNull());
    }
    @Test void activeCustomerCanBeSelectedByBothRolesAndResponseIsMinimal() throws Exception {
        long id = customer("María Quispe");
        for (String token : List.of(admin, employee)) {
            var result = sell(token, associated(id, 1)).andExpect(status().isCreated())
                    .andExpect(jsonPath("customer.id").value(id)).andExpect(jsonPath("customer.name").value("María Quispe"))
                    .andExpect(jsonPath("customer.phone").doesNotExist()).andExpect(jsonPath("customer.notes").doesNotExist()).andReturn();
            long saleId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
            mvc.perform(get("/api/sales/" + saleId).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("customer.id").value(id));
        }
    }
    @Test void missingAndInactiveCustomersCannotConsumeStock() throws Exception {
        sell(admin, associated(999999999, 1)).andExpect(status().isNotFound());
        long id = customer("Inactiva"); jdbc.update("update customers set active=false where id=?", id);
        sell(employee, associated(id, 1)).andExpect(status().isConflict()).andExpect(jsonPath("message").value("El cliente seleccionado no está activo."));
        assertEquals(24, stock()); assertEquals(0, count("sales")); assertEquals(0, count("inventory_movements"));
    }
    @Test void manipulatedCustomerFieldsAreRejected() throws Exception {
        for (Object id : List.of(-1, 0, 1.5, "invalid")) {
            var request = body(1); request.put("customerId", id); sell(admin, request).andExpect(status().isBadRequest());
        }
        var request = body(1); request.put("customer", Map.of("id", 1, "active", true));
        sell(employee, request).andExpect(status().isBadRequest());
    }
    @Test void retryKeepsCustomerEvenAfterDeactivationAndDifferentCustomerConflicts() throws Exception {
        long first = customer("María"); long second = customer("Juan");
        var request = associated(first, 2);
        var original = sell(admin, request).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        jdbc.update("update customers set active=false where id=?", first);
        var retry = sell(admin, request).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertEquals(json.readTree(original).get("id"), json.readTree(retry).get("id"));
        request.put("customerId", second); sell(admin, request).andExpect(status().isConflict());
        request.remove("customerId"); sell(admin, request).andExpect(status().isConflict());
        assertEquals(22, stock()); assertEquals(1, count("sales"));
    }
    @Test void legacyNullCustomerFingerprintRemainsReplayable() throws Exception {
        var request = body(1);
        String canonical = "YAPE:" + product + "=1";
        String fingerprint = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        long id = jdbc.queryForObject("insert into sales(request_id,request_fingerprint,total,payment_method,created_by,created_at) values (?::uuid,?,3.50,'YAPE',?,now()) returning id",
                Long.class, request.get("requestId"), fingerprint, actor);
        sell(admin, request).andExpect(status().isCreated()).andExpect(jsonPath("id").value(id)).andExpect(jsonPath("customer").isEmpty());
        assertEquals(24, stock()); assertEquals(1, count("sales"));
    }
    @Test void customerHistoryIsPaginatedAndExcludesGeneralPublicAndOtherCustomers() throws Exception {
        long first = customer("María"); long second = customer("Juan");
        sell(admin, associated(first, 1)).andExpect(status().isCreated());
        var latest = sell(employee, associated(first, 2)).andExpect(status().isCreated()).andReturn();
        long latestId = json.readTree(latest.getResponse().getContentAsString()).get("id").asLong();
        sell(admin, body(1)).andExpect(status().isCreated()); sell(admin, associated(second, 1)).andExpect(status().isCreated());
        jdbc.update("update customers set active=false where id=?", first);
        for (String token : List.of(admin, employee)) {
            mvc.perform(get("/api/customers/" + first + "/sales").param("size", "1").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("total").value(2)).andExpect(jsonPath("items[0].id").value(latestId))
                    .andExpect(jsonPath("items[0].total").value(7)).andExpect(jsonPath("items[0].paymentMethod").value("YAPE"))
                    .andExpect(jsonPath("items[0].items").doesNotExist()).andExpect(jsonPath("items[0].createdBy").doesNotExist());
            mvc.perform(get("/api/customers/" + first + "/sales").param("page", "1").param("size", "1").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("items.length()").value(1));
        }
    }
    @Test void historyValidatesCustomerSessionAndPaginationAndCanBeEmpty() throws Exception {
        long id = customer("Sin compras");
        mvc.perform(get("/api/customers/" + id + "/sales")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/customers/" + id + "/sales").header("Authorization", "Bearer " + employee))
                .andExpect(status().isOk()).andExpect(jsonPath("total").value(0)).andExpect(jsonPath("items").isEmpty());
        mvc.perform(get("/api/customers/999999999/sales").header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound());
        for (var entry : Map.of("page", "-1", "size", "101").entrySet())
            mvc.perform(get("/api/customers/" + id + "/sales").param(entry.getKey(), entry.getValue()).header("Authorization", "Bearer " + admin))
                    .andExpect(status().isBadRequest());
    }
    @Test void associatedSaleWithInsufficientStockRollsBack() throws Exception {
        long id = customer("María"); sell(admin, associated(id, 25)).andExpect(status().isConflict());
        assertEquals(24, stock()); assertEquals(0, count("sales")); assertEquals(0, count("sale_items")); assertEquals(0, count("inventory_movements"));
    }
    @Test void associatedSalesForDifferentCustomersCannotOversellLastUnit() throws Exception {
        long a = customer("María"); long b = customer("Juan"); jdbc.update("update products set stock=1 where id=?", product);
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var futures = new ArrayList<Future<Integer>>();
            for (long id : List.of(a, b)) futures.add(pool.submit(() -> {
                ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); return sell(admin, associated(id, 1)).andReturn().getResponse().getStatus();
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(List.of(201, 409), java.util.stream.Stream.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS)).sorted().toList());
        }
        assertEquals(0, stock()); assertEquals(1, count("sales"));
    }
    @Test void simultaneousRetryWithSameCustomerReturnsOneSale() throws Exception {
        var request = associated(customer("María"), 2);
        var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Long> task = () -> {
                ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS));
                var result = sell(admin, request).andExpect(status().isCreated()).andReturn();
                return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
            };
            var a = pool.submit(task); var b = pool.submit(task); assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
        }
        assertEquals(22, stock()); assertEquals(1, count("sales"));
    }
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
