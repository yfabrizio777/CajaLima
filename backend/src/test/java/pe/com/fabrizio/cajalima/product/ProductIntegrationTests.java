package pe.com.fabrizio.cajalima.product;

import java.util.*;
import java.security.SecureRandom;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
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
@Transactional
class ProductIntegrationTests {
    private static final String SCHEMA = "product_test_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    private String admin;
    private String employee;
    private Long adminId;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.flyway.schemas", () -> SCHEMA);
        r.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        r.add("spring.datasource.hikari.schema", () -> SCHEMA);
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key);
        r.add("app.jwt.secret", () -> Base64.getEncoder().encodeToString(key));
        r.add("app.jwt.expiration", () -> 3600000);
    }
    @AfterAll static void cleanup(@Autowired JdbcTemplate jdbc) {
        if (!SCHEMA.matches("product_test_[a-f0-9]{32}")) throw new IllegalStateException();
        jdbc.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
    }
    @BeforeEach void accounts() {
        User owner = users.saveAndFlush(new User("Prueba", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.ADMIN));
        adminId = owner.getId(); admin = jwt.issue(owner).token();
        employee = jwt.issue(users.saveAndFlush(new User("Prueba", UUID.randomUUID() + "@example.invalid", "unused-test-hash", UserRole.EMPLOYEE))).token();
    }
    private Map<String, Object> valid() {
        return new HashMap<>(Map.of("name", "Inca Kola 500 ml", "sku", " ik500 ", "salePrice", "3.50", "initialStock", 24, "minimumStock", 5, "active", true));
    }
    private ResultActions send(MockHttpServletRequestBuilder request, String token, Object body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token).contentType("application/json").content(json.writeValueAsString(body)));
    }
    private long create() throws Exception {
        String body = send(post("/api/products"), admin, valid()).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
    @Test void adminCreatesValidProductAndInitialMovement() throws Exception {
        long id = create();
        mvc.perform(get("/api/products/" + id).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("sku").value("IK500"))
                .andExpect(jsonPath("salePrice").value(3.5)).andExpect(jsonPath("lowStock").value(false));
        assertEquals(1, jdbc.queryForObject("select count(*) from inventory_movements where product_id=? and type='INITIAL' and quantity=24 and created_by=?", Integer.class, id, adminId));
    }
    @Test void employeeCannotCreate() throws Exception { send(post("/api/products"), employee, valid()).andExpect(status().isForbidden()); }
    @Test void anonymousCannotReadOrWrite() throws Exception {
        mvc.perform(get("/api/products")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/products").contentType("application/json").content(json.writeValueAsString(valid()))).andExpect(status().isUnauthorized());
    }
    @Test void duplicateNormalizedSkuConflicts() throws Exception { create(); send(post("/api/products"), admin, valid()).andExpect(status().isConflict()); }
    @Test void optionalSkuAllowsMultipleProducts() throws Exception {
        var input = valid(); input.remove("sku");
        send(post("/api/products"), admin, input).andExpect(status().isCreated());
        send(post("/api/products"), admin, input).andExpect(status().isCreated());
    }
    @Test void negativePriceRejected() throws Exception { var input = valid(); input.put("salePrice", -1); send(post("/api/products"), admin, input).andExpect(status().isBadRequest()); }
    @Test void negativeStockRejected() throws Exception { var input = valid(); input.put("initialStock", -1); send(post("/api/products"), admin, input).andExpect(status().isBadRequest()); }
    @Test void absurdValuesAndPrecisionRejected() throws Exception {
        for (var entry : Map.of("salePrice", "1.999", "initialStock", 1000001, "minimumStock", -1, "costPrice", -1, "name", "  ").entrySet()) {
            var input = valid(); input.put(entry.getKey(), entry.getValue()); send(post("/api/products"), admin, input).andExpect(status().isBadRequest());
        }
        var input = valid(); input.put("salePrice", "NaN"); send(post("/api/products"), admin, input).andExpect(status().isBadRequest());
    }
    @Test void listAllowsEmployeeAndPagination() throws Exception {
        create(); mvc.perform(get("/api/products?size=1").header("Authorization", "Bearer " + employee)).andExpect(status().isOk()).andExpect(jsonPath("total").value(1)).andExpect(jsonPath("items.length()").value(1));
    }
    @Test void searchName() throws Exception { create(); search("kola", 1); }
    @Test void searchSku() throws Exception { create(); search("ik500", 1); }
    @Test void searchEscapesWildcardsAndSql() throws Exception { create(); search("%", 0); search("' OR 1=1 --", 0); }
    private void search(String query, int expected) throws Exception {
        mvc.perform(get("/api/products").param("search", query).header("Authorization", "Bearer " + employee)).andExpect(status().isOk()).andExpect(jsonPath("total").value(expected));
    }
    @Test void lowStockUsesInclusiveThreshold() throws Exception {
        var input = valid(); input.put("initialStock", 5); send(post("/api/products"), admin, input).andExpect(status().isCreated());
        mvc.perform(get("/api/products?lowStock=true").header("Authorization", "Bearer " + employee)).andExpect(jsonPath("total").value(1)).andExpect(jsonPath("items[0].lowStock").value(true));
    }
    @Test void adjustmentRecordsServerStocksAndActor() throws Exception {
        long id = create(); send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", 3, "reason", "Conteo físico")).andExpect(status().isOk()).andExpect(jsonPath("stock").value(3));
        assertEquals(1, jdbc.queryForObject("select count(*) from inventory_movements where product_id=? and type='ADJUSTMENT' and previous_stock=24 and new_stock=3 and quantity=-21 and created_by=?", Integer.class, id, adminId));
    }
    @Test void employeeCannotAdjustEditOrChangeStatus() throws Exception {
        long id = create();
        send(post("/api/products/" + id + "/stock-adjustments"), employee, Map.of("newStock", 2, "reason", "Conteo")).andExpect(status().isForbidden());
        send(patch("/api/products/" + id + "/status"), employee, Map.of("active", false)).andExpect(status().isForbidden());
        send(put("/api/products/" + id), employee, edit()).andExpect(status().isForbidden());
        assertEquals(24, jdbc.queryForObject("select stock from products where id=?", Integer.class, id));
    }
    private Map<String, Object> edit() { return new HashMap<>(Map.of("name", "Producto editado", "salePrice", "4.00", "minimumStock", 2)); }
    @Test void editCannotChangeStockOrInternalFields() throws Exception {
        long id = create(); var input = edit(); input.put("stock", 999);
        send(put("/api/products/" + id), admin, input).andExpect(status().isBadRequest());
        input.remove("stock"); input.put("id", 100); send(put("/api/products/" + id), admin, input).andExpect(status().isBadRequest());
    }
    @Test void editBasicFieldsPreservesStock() throws Exception {
        long id = create(); send(put("/api/products/" + id), admin, edit()).andExpect(status().isOk()).andExpect(jsonPath("name").value("Producto editado")).andExpect(jsonPath("stock").value(24));
    }
    @Test void negativeOrUnchangedAdjustmentsAndEmptyReasonRejected() throws Exception {
        long id = create();
        for (int stock : new int[] {-1, 24, 1000001}) send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", stock, "reason", "Conteo")).andExpect(status().isBadRequest());
        send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", 0, "reason", " ")).andExpect(status().isBadRequest());
        assertEquals(24, jdbc.queryForObject("select stock from products where id=?", Integer.class, id));
    }
    @Test void adjustmentRejectsSpoofedPreviousStockAndActor() throws Exception {
        long id = create(); send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", 2, "reason", "Conteo", "previousStock", 0, "createdBy", 1)).andExpect(status().isBadRequest());
    }
    @Test void missingProductReturns404() throws Exception { mvc.perform(get("/api/products/999999999").header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound()); }
    @Test void statusFiltersAndSummaryUseRealProducts() throws Exception {
        long id = create(); send(patch("/api/products/" + id + "/status"), admin, Map.of("active", false)).andExpect(status().isOk());
        mvc.perform(get("/api/products?active=false").header("Authorization", "Bearer " + employee)).andExpect(jsonPath("total").value(1));
        mvc.perform(get("/api/products/summary").header("Authorization", "Bearer " + employee)).andExpect(jsonPath("activeProducts").value(0));
        send(patch("/api/products/" + id + "/status"), admin, Map.of("active", true)).andExpect(status().isOk());
        mvc.perform(get("/api/products/summary").header("Authorization", "Bearer " + employee)).andExpect(jsonPath("activeProducts").value(1));
    }
    @Test void invalidQueryReturns400() throws Exception {
        for (String query : List.of("size=101", "page=-1", "active=invalid", "size=word")) mvc.perform(get("/api/products?" + query).header("Authorization", "Bearer " + admin)).andExpect(status().isBadRequest());
    }
    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentAdjustmentsPreserveMovementChain() throws Exception {
        long id = create();
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            var a = executor.submit(() -> { start.await(); send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", 7, "reason", "Conteo A")).andExpect(status().isOk()); return true; });
            var b = executor.submit(() -> { start.await(); send(post("/api/products/" + id + "/stock-adjustments"), admin, Map.of("newStock", 11, "reason", "Conteo B")).andExpect(status().isOk()); return true; });
            start.countDown();
            assertTrue(a.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(b.get(15, java.util.concurrent.TimeUnit.SECONDS));
            var rows = jdbc.queryForList("select previous_stock, new_stock from inventory_movements where product_id=? order by id", id);
            assertEquals(3, rows.size());
            assertEquals(24, rows.get(1).get("previous_stock"));
            assertEquals(rows.get(1).get("new_stock"), rows.get(2).get("previous_stock"));
            assertEquals(rows.get(2).get("new_stock"), jdbc.queryForObject("select stock from products where id=?", Integer.class, id));
        } finally {
            jdbc.update("delete from inventory_movements where product_id=?", id);
            jdbc.update("delete from products where id=?", id);
        }
    }
    @Test void databaseRejectsNegativeStock() throws Exception {
        long id = create();
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update products set stock=-1 where id=?", id));
    }
    @Test void zeroInitialStockHasNoMovement() throws Exception {
        var input = valid(); input.put("initialStock", 0); send(post("/api/products"), admin, input).andExpect(status().isCreated());
        assertEquals(0, jdbc.queryForObject("select count(*) from inventory_movements", Integer.class));
    }
}
