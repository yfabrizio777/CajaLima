package pe.com.fabrizio.cajalima.account;

import java.math.BigDecimal;
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
class AccountIntegrationTests {
    private static final String SCHEMA = "account_test_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    private String admin;
    private String employee;
    private long actor;
    private long customer;
    private long product;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.flyway.schemas", () -> SCHEMA);
        r.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        r.add("spring.datasource.hikari.schema", () -> SCHEMA);
        r.add("app.jwt.secret", () -> UUID.randomUUID().toString() + UUID.randomUUID());
        r.add("app.jwt.expiration", () -> 3600000);
    }
    @AfterAll static void cleanup(@Autowired JdbcTemplate jdbc) {
        if (!SCHEMA.matches("account_test_[a-f0-9]{32}")) throw new IllegalStateException();
        jdbc.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
    }
    @BeforeEach void fixtures() {
        var owner = users.saveAndFlush(new User("Admin Prueba", UUID.randomUUID() + "@example.invalid", "unused", UserRole.ADMIN));
        actor = owner.getId(); admin = jwt.issue(owner).token();
        employee = jwt.issue(users.saveAndFlush(new User("Colaborador Prueba", UUID.randomUUID() + "@example.invalid", "unused", UserRole.EMPLOYEE))).token();
        customer = newCustomer();
        product = jdbc.queryForObject("insert into products(name,sale_price,stock,minimum_stock,active,created_at,updated_at) values ('Producto',10,10,0,true,now(),now()) returning id", Long.class);
    }
    private long newCustomer() { return jdbc.queryForObject("insert into customers(name,active,created_at,updated_at) values ('María Quispe',true,now(),now()) returning id", Long.class); }
    private Map<String, Object> sale(String method, Long customerId, int quantity) {
        var body = new HashMap<String, Object>(Map.of("requestId", UUID.randomUUID().toString(), "paymentMethod", method, "items", List.of(Map.of("productId", product, "quantity", quantity))));
        if (customerId != null) body.put("customerId", customerId); return body;
    }
    private Map<String, Object> payment(String amount) { return new HashMap<>(Map.of("requestId", UUID.randomUUID().toString(), "amount", new BigDecimal(amount), "paymentMethod", "YAPE", "note", "Pago de prueba")); }
    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token, Object body) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.contentType("application/json").content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    private ResultActions pay(String token, long id, Object body) throws Exception { return send(post("/api/customers/" + id + "/payments"), token, body); }
    private void credit(int quantity) throws Exception { send(post("/api/sales"), admin, sale("CREDIT", customer, quantity)).andExpect(status().isCreated()); }
    private ResultActions account(String token, long id) throws Exception { return send(get("/api/customers/" + id + "/account"), token, null); }
    private long movementCount() { return jdbc.queryForObject("select count(*) from customer_account_movements where customer_id=?", Long.class, customer); }
    @Test void creditSaleCreatesLedgerAndStockInOneTransaction() throws Exception {
        credit(3);
        account(admin, customer).andExpect(status().isOk()).andExpect(jsonPath("outstandingBalance").value("30.00")).andExpect(jsonPath("totalCredit").value("30.00")).andExpect(jsonPath("totalPaid").value("0.00"));
        assertEquals(7, jdbc.queryForObject("select stock from products where id=?", Integer.class, product));
        assertEquals(1, movementCount());
        assertEquals("CREDIT", jdbc.queryForObject("select type from customer_account_movements where customer_id=?", String.class, customer));
    }
    @Test void creditRequiresActiveExistingCustomerAndPositiveSale() throws Exception {
        send(post("/api/sales"), admin, sale("CREDIT", null, 1)).andExpect(status().isBadRequest());
        send(post("/api/sales"), admin, sale("CREDIT", 999999999L, 1)).andExpect(status().isNotFound());
        jdbc.update("update customers set active=false where id=?", customer);
        send(post("/api/sales"), admin, sale("CREDIT", customer, 1)).andExpect(status().isConflict());
        jdbc.update("update customers set active=true where id=?", customer);
        jdbc.update("update products set sale_price=0 where id=?", product);
        send(post("/api/sales"), admin, sale("CREDIT", customer, 1)).andExpect(status().isBadRequest());
    }
    @Test void partialThenFullPaymentDerivesZeroWithoutNegativeBalance() throws Exception {
        credit(3);
        pay(employee, customer, payment("10.00")).andExpect(status().isCreated()).andExpect(jsonPath("type").value("PAYMENT")).andExpect(jsonPath("paymentMethod").value("YAPE"));
        account(admin, customer).andExpect(jsonPath("outstandingBalance").value("20.00"));
        pay(admin, customer, payment("20.00")).andExpect(status().isCreated());
        account(employee, customer).andExpect(jsonPath("outstandingBalance").value("0.00")).andExpect(jsonPath("totalPaid").value("30.00")).andExpect(jsonPath("lastMovementAt").isNotEmpty());
        pay(admin, customer, payment("1")).andExpect(status().isConflict());
        assertEquals(3, movementCount());
    }
    @Test void overpaymentAndInvalidAmountsAreRejected() throws Exception {
        credit(2);
        pay(admin, customer, payment("20.01")).andExpect(status().isConflict());
        for (String amount : List.of("0", "-1", "1.001", "1000000000000")) pay(admin, customer, payment(amount)).andExpect(status().isBadRequest());
        assertEquals(1, movementCount());
    }
    @Test void paymentRequiresExistingActiveCustomerAndPaymentMethod() throws Exception {
        pay(admin, 999999999, payment("1")).andExpect(status().isNotFound());
        credit(1); jdbc.update("update customers set active=false where id=?", customer);
        pay(employee, customer, payment("1")).andExpect(status().isConflict());
        account(employee, customer).andExpect(status().isOk()).andExpect(jsonPath("outstandingBalance").value("10.00"));
        jdbc.update("update customers set active=true where id=?", customer);
        var body = payment("1"); body.put("paymentMethod", "CREDIT"); pay(admin, customer, body).andExpect(status().isBadRequest());
        body.remove("paymentMethod"); pay(admin, customer, body).andExpect(status().isBadRequest());
    }
    @Test void paymentRetriesDoNotDuplicateEvenAfterFullPaymentOrDeactivation() throws Exception {
        credit(2); var body = payment("20");
        var first = pay(admin, customer, body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        jdbc.update("update customers set active=false where id=?", customer);
        var retry = pay(admin, customer, body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertEquals(json.readTree(first).get("id"), json.readTree(retry).get("id")); assertEquals(2, movementCount());
    }
    @Test void requestIdCannotChangeIntentOrActorOrCustomer() throws Exception {
        credit(3); var body = payment("5"); pay(admin, customer, body).andExpect(status().isCreated());
        for (var entry : Map.of("amount", (Object)new BigDecimal("6"), "paymentMethod", "CASH", "note", "distinta").entrySet()) {
            var changed = new HashMap<>(body); changed.put(entry.getKey(), entry.getValue()); pay(admin, customer, changed).andExpect(status().isConflict());
        }
        pay(employee, customer, body).andExpect(status().isConflict());
        pay(admin, newCustomer(), body).andExpect(status().isConflict()); assertEquals(2, movementCount());
    }
    @Test void concurrentPaymentsCannotOverdraw() throws Exception {
        credit(2); var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> task = () -> { ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); return pay(employee, customer, payment("15")).andReturn().getResponse().getStatus(); };
            var a = pool.submit(task); var b = pool.submit(task); assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(List.of(201,409), java.util.stream.Stream.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS)).sorted().toList());
        }
        account(admin,customer).andExpect(jsonPath("outstandingBalance").value("5.00")); assertEquals(2,movementCount());
    }
    @Test void simultaneousPaymentRetryReturnsSameMovement() throws Exception {
        credit(2); var body = payment("10"); var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Long> task = () -> { ready.countDown(); assertTrue(start.await(10,TimeUnit.SECONDS)); var r=pay(admin,customer,body).andExpect(status().isCreated()).andReturn(); return json.readTree(r.getResponse().getContentAsString()).get("id").asLong(); };
            var a=pool.submit(task); var b=pool.submit(task); assertTrue(ready.await(10,TimeUnit.SECONDS)); start.countDown(); assertEquals(a.get(20,TimeUnit.SECONDS), b.get(20,TimeUnit.SECONDS));
        }
        assertEquals(2,movementCount()); account(admin,customer).andExpect(jsonPath("outstandingBalance").value("10.00"));
    }
    @Test void historyIsPaginatedAuditableAndSharedByBothRoles() throws Exception {
        credit(2); pay(admin,customer,payment("5")).andExpect(status().isCreated());
        for (String token : List.of(admin,employee)) {
            send(get("/api/customers/"+customer+"/account/movements").param("size","1"),token,null).andExpect(status().isOk())
                    .andExpect(jsonPath("total").value(2)).andExpect(jsonPath("items[0].type").value("PAYMENT"))
                    .andExpect(jsonPath("items[0].createdBy").value(actor)).andExpect(jsonPath("items[0].createdByName").value("Admin Prueba"))
                    .andExpect(jsonPath("items[0].note").value("Pago de prueba"));
            send(get("/api/customers/"+customer+"/account/movements").param("page","1").param("size","1"),token,null).andExpect(jsonPath("items[0].type").value("CREDIT")).andExpect(jsonPath("items[0].saleId").isNumber());
        }
    }
    @Test void summaryAndEmptyHistoryDoNotMixCustomers() throws Exception {
        credit(2); long other=newCustomer();
        account(admin,other).andExpect(status().isOk()).andExpect(jsonPath("outstandingBalance").value("0.00")).andExpect(jsonPath("lastMovementAt").isEmpty());
        send(get("/api/customers/"+other+"/account/movements"),employee,null).andExpect(jsonPath("total").value(0));
        account(admin,999999999).andExpect(status().isNotFound());
        send(get("/api/customers/"+customer+"/account/movements").param("page","-1"),admin,null).andExpect(status().isBadRequest());
        send(get("/api/customers/"+customer+"/account/movements").param("size","101"),admin,null).andExpect(status().isBadRequest());
    }
    @Test void anonymousAndMassAssignmentAreRejected() throws Exception {
        send(get("/api/customers/"+customer+"/account"),null,null).andExpect(status().isUnauthorized());
        send(get("/api/customers/"+customer+"/account/movements"),null,null).andExpect(status().isUnauthorized());
        pay(null,customer,payment("1")).andExpect(status().isUnauthorized()); credit(2);
        for (String field:List.of("balance","previousBalance","newBalance","createdBy","saleId","type")) { var body=payment("1"); body.put(field,1); pay(employee,customer,body).andExpect(status().isBadRequest()); }
        var body=payment("1"); body.put("note","x".repeat(241)); pay(admin,customer,body).andExpect(status().isBadRequest());
        body=payment("1"); body.remove("requestId"); pay(admin,customer,body).andExpect(status().isBadRequest());
    }
    @Test void normalPaymentsDoNotCreateDebtAndEmployeeCanSellCredit() throws Exception {
        for(String method:List.of("CASH","YAPE","PLIN","TRANSFER")) send(post("/api/sales"),employee,sale(method,customer,1)).andExpect(status().isCreated());
        assertEquals(0,movementCount());
        send(post("/api/sales"),employee,sale("CREDIT",customer,1)).andExpect(status().isCreated());
        account(admin,customer).andExpect(jsonPath("outstandingBalance").value("10.00"));
    }
    @Test void creditRetryCreatesOnlyOneFinancialMovement() throws Exception {
        var body=sale("CREDIT",customer,2); send(post("/api/sales"),admin,body).andExpect(status().isCreated());
        send(post("/api/sales"),admin,body).andExpect(status().isCreated()); assertEquals(1,movementCount());
    }
    @Test void ledgerFailureRollsBackSaleItemsStockAndInventory() throws Exception {
        jdbc.execute("alter table customer_account_movements add constraint fail_credit_test check (customer_id <> "+customer+")");
        try { send(post("/api/sales"),admin,sale("CREDIT",customer,3)).andExpect(status().isConflict()); }
        finally { jdbc.execute("alter table customer_account_movements drop constraint fail_credit_test"); }
        assertEquals(10,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
        assertEquals(0,jdbc.queryForObject("select count(*) from sales where customer_id=?",Integer.class,customer));
        assertEquals(0,jdbc.queryForObject("select count(*) from inventory_movements where product_id=?",Integer.class,product)); assertEquals(0,movementCount());
    }
    @Test void paymentNotesRejectMalformedUnicodeAndPermitEmoji() throws Exception {
        credit(3);
        for(char c:new char[]{0,(char)0xD800,(char)0xDC00}){
            String escaped="\\u"+String.format("%04x",(int)c);
            String raw="{\"requestId\":\""+UUID.randomUUID()+"\",\"amount\":1,\"paymentMethod\":\"YAPE\",\"note\":\""+escaped+"\"}";
            mvc.perform(post("/api/customers/"+customer+"/payments").header("Authorization","Bearer "+admin).contentType("application/json").content(raw)).andExpect(status().isBadRequest());
        }
        var body=payment("1");body.put("note",new String(Character.toChars(0x1F44D)));pay(admin,customer,body).andExpect(status().isCreated());
    }
    @Test void globalRequestIdContentionAcrossCustomersIsAConflict() throws Exception {
        credit(2); long other=newCustomer();send(post("/api/sales"),admin,sale("CREDIT",other,2)).andExpect(status().isCreated());
        var request=payment("5");var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            var futures=new ArrayList<Future<Integer>>();
            for(long id:List.of(customer,other))futures.add(pool.submit(()->{ready.countDown();assertTrue(start.await(10,TimeUnit.SECONDS));return pay(admin,id,request).andReturn().getResponse().getStatus();}));
            assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();
            assertEquals(List.of(201,409),java.util.stream.Stream.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS)).sorted().toList());
        }
    }
    @Test void compositeCreditReferenceRejectsInconsistentOrMissingSaleTuple() throws Exception {
        var result=send(post("/api/sales"),admin,sale("CASH",customer,2)).andExpect(status().isCreated()).andReturn();
        long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        long other=newCustomer();
        for(String method:List.of("'CREDIT'","NULL"))assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->
            jdbc.update("insert into customer_account_movements(customer_id,sale_id,type,amount,sale_payment_method,created_by,created_at) values (?,?,'CREDIT',1,"+method+",?,now())",other,id,actor));
    }
}
