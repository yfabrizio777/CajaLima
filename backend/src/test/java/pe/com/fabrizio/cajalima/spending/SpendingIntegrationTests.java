package pe.com.fabrizio.cajalima.spending;

import java.math.BigDecimal;
import java.time.*;
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
@SpringBootTest(properties="spring.docker.compose.skip.in-tests=false")
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class SpendingIntegrationTests {
    static final String SCHEMA="spending_test_"+UUID.randomUUID().toString().replace("-","");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    String admin,employee;
    long actor,product;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){
        r.add("spring.flyway.schemas",()->SCHEMA);r.add("spring.jpa.properties.hibernate.default_schema",()->SCHEMA);r.add("spring.datasource.hikari.schema",()->SCHEMA);
        r.add("app.jwt.secret",()->UUID.randomUUID().toString()+UUID.randomUUID());r.add("app.jwt.expiration",()->3600000);
    }
    @AfterAll static void cleanup(@Autowired JdbcTemplate jdbc){if(!SCHEMA.matches("spending_test_[a-f0-9]{32}"))throw new IllegalStateException();jdbc.execute("DROP SCHEMA "+SCHEMA+" CASCADE");}
    @BeforeEach void fixtures(){var owner=users.saveAndFlush(new User("Admin Prueba",UUID.randomUUID()+"@example.invalid","unused",UserRole.ADMIN));actor=owner.getId();admin=jwt.issue(owner).token();employee=jwt.issue(users.saveAndFlush(new User("Colaborador",UUID.randomUUID()+"@example.invalid","unused",UserRole.EMPLOYEE))).token();product=jdbc.queryForObject("insert into products(name,sale_price,stock,minimum_stock,active,created_at,updated_at) values ('Mercadería',10,5,0,true,now(),now()) returning id",Long.class);}
    String today(){return LocalDate.now(ZoneId.of("America/Lima")).toString();}
    Map<String,Object> expense(){return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"description","Transporte de mercadería","category","TRANSPORT","amount","12.50","paymentMethod","CASH","expenseDate",today(),"notes","Movilidad"));}
    Map<String,Object> purchase(){return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"description","Reposición","supplierName","Proveedor local","paymentMethod","YAPE","purchaseDate",today(),"notes","Recepción completa","items",List.of(Map.of("productId",product,"quantity",10,"unitCost","2.50"))));}
    ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,String token,Object body)throws Exception{if(token!=null)request.header("Authorization","Bearer "+token);if(body!=null)request.contentType("application/json").content(json.writeValueAsString(body));return mvc.perform(request);}
    long id(ResultActions result)throws Exception{var node=json.readTree(result.andReturn().getResponse().getContentAsString());return (node.has("purchase")?node.get("purchase"):node).get("id").asLong();}
    @Test void createsExpenseWithServerActor()throws Exception{send(post("/api/expenses"),employee,expense()).andExpect(status().isCreated()).andExpect(jsonPath("amount").value("12.50")).andExpect(jsonPath("category").value("TRANSPORT")).andExpect(jsonPath("createdBy").isNumber());}
    @Test void purchaseCalculatesTotalAndUpdatesStockAndMovement()throws Exception{
        long id=id(send(post("/api/purchases"),employee,purchase()).andExpect(status().isCreated()).andExpect(jsonPath("purchase.total").value("25.00")).andExpect(jsonPath("items[0].subtotal").value("25.00")));
        assertEquals(15,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
        assertEquals(1,jdbc.queryForObject("select count(*) from inventory_movements where purchase_id=? and product_id=? and type='PURCHASE' and quantity=10 and previous_stock=5 and new_stock=15",Integer.class,id,product));
    }
    @Test void expenseRejectsInvalidAmountsFieldsDatesAndEnums()throws Exception{
        for(String amount:List.of("0","-1","1.001","1000000000000")){var r=expense();r.put("amount",amount);send(post("/api/expenses"),admin,r).andExpect(status().isBadRequest());}
        for(var field:Map.<String,Object>of("description"," ","category","INVALID","expenseDate","1999-12-31","paymentMethod","CREDIT","notes","a".repeat(501),"createdBy",actor,"total","0").entrySet()){var r=expense();r.put(field.getKey(),field.getValue());send(post("/api/expenses"),admin,r).andExpect(status().isBadRequest());}
    }
    @Test void expenseCategoriesAndPaymentMethodsAreSupported()throws Exception{
        for(String category:List.of("RENT","SERVICES","TRANSPORT","SUPPLIES","MAINTENANCE","OTHER")){var r=expense();r.put("category",category);send(post("/api/expenses"),admin,r).andExpect(status().isCreated());}
        for(String method:List.of("CASH","YAPE","PLIN","TRANSFER")){var r=expense();r.put("paymentMethod",method);send(post("/api/expenses"),employee,r).andExpect(status().isCreated());}
    }
    @Test void noAnonymousFinancialOperations()throws Exception{
        for(String path:List.of("/api/expenses","/api/purchases","/api/expenses/1","/api/purchases/1","/api/expenses/summary","/api/purchases/summary"))send(get(path),null,null).andExpect(status().isUnauthorized());
        send(post("/api/expenses"),null,expense()).andExpect(status().isUnauthorized());send(post("/api/purchases"),null,purchase()).andExpect(status().isUnauthorized());
    }
    @Test void financialFieldsCannotBeAssignedOrDeleted()throws Exception{
        for(String key:List.of("total","subtotal","createdBy","stock","createdAt","id")){var r=purchase();r.put(key,1);send(post("/api/purchases"),employee,r).andExpect(status().isBadRequest());}
        long e=id(send(post("/api/expenses"),admin,expense()).andExpect(status().isCreated()));long p=id(send(post("/api/purchases"),admin,purchase()).andExpect(status().isCreated()));
        send(delete("/api/expenses/"+e),admin,null).andExpect(status().isMethodNotAllowed());send(delete("/api/purchases/"+p),admin,null).andExpect(status().isMethodNotAllowed());
    }
    @Test void purchaseValidatesItemsAndDoesNotTouchStockOnFailure()throws Exception{
        for(Object qty:List.of(0,-1,1000001,1.5)){var r=purchase();r.put("items",List.of(Map.of("productId",product,"quantity",qty,"unitCost","2")));send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());}
        for(String cost:List.of("0","-1","1.001","100000000")){var r=purchase();r.put("items",List.of(Map.of("productId",product,"quantity",1,"unitCost",cost)));send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());}
        var r=purchase();r.put("items",List.of(Map.of("productId",product,"quantity",1,"unitCost","2"),Map.of("productId",product,"quantity",2,"unitCost","2")));send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());
        r.put("items",List.of());send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());
        r.put("items",Arrays.asList((Object)null));send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());
        assertEquals(5,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
    }
    @Test void missingInactiveProductAndStockCapAreControlled()throws Exception{
        var r=purchase();r.put("items",List.of(Map.of("productId",999999999,"quantity",1,"unitCost","2")));send(post("/api/purchases"),admin,r).andExpect(status().isNotFound());
        jdbc.update("update products set active=false where id=?",product);send(post("/api/purchases"),employee,purchase()).andExpect(status().isConflict());
        jdbc.update("update products set active=true,stock=999995 where id=?",product);send(post("/api/purchases"),admin,purchase()).andExpect(status().isConflict());
    }
    @Test void aggregateTotalLimitIsCheckedBeforeWriting()throws Exception{
        jdbc.update("update products set stock=0 where id=?",product);var r=purchase();r.put("items",List.of(Map.of("productId",product,"quantity",1000000,"unitCost","99999999.99")));send(post("/api/purchases"),admin,r).andExpect(status().isBadRequest());assertEquals(0,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
    }
    @Test void purchaseFailureRollsBackEveryFinancialAndStockWrite()throws Exception{
        jdbc.execute("alter table inventory_movements add constraint fail_purchase_test check (product_id <> "+product+" or type <> 'PURCHASE')");
        try{send(post("/api/purchases"),admin,purchase()).andExpect(status().isConflict());}finally{jdbc.execute("alter table inventory_movements drop constraint fail_purchase_test");}
        assertEquals(5,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));assertEquals(0,jdbc.queryForObject("select count(*) from purchase_items where product_id=?",Integer.class,product));assertEquals(0,jdbc.queryForObject("select count(*) from inventory_movements where product_id=?",Integer.class,product));
        assertEquals(0,jdbc.queryForObject("select count(*) from purchases where created_by=?",Integer.class,actor));
    }
    @Test void purchaseRetryIsStableAfterMetadataEditAndDeactivation()throws Exception{
        var r=purchase();long p=id(send(post("/api/purchases"),admin,r).andExpect(status().isCreated()));
        send(put("/api/purchases/"+p+"/details"),admin,Map.of("description","Texto corregido","supplierName","Proveedor corregido","notes","Recepción" )).andExpect(status().isOk());
        jdbc.update("update products set active=false where id=?",product);
        assertEquals(p,id(send(post("/api/purchases"),admin,r).andExpect(status().isCreated())));assertEquals(15,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
        var changed=new HashMap<>(r);changed.put("supplierName","Otro");send(post("/api/purchases"),admin,changed).andExpect(status().isConflict());send(post("/api/purchases"),employee,r).andExpect(status().isConflict());
    }
    @Test void expenseRetryDoesNotDuplicateAndRejectsChangedIntent()throws Exception{
        var r=expense();long first=id(send(post("/api/expenses"),admin,r).andExpect(status().isCreated()));assertEquals(first,id(send(post("/api/expenses"),admin,r).andExpect(status().isCreated())));
        for(var entry:Map.<String,Object>of("amount","13","description","Otra","notes","otra","category","OTHER","paymentMethod","YAPE","expenseDate","2026-01-01").entrySet()){var changed=new HashMap<>(r);changed.put(entry.getKey(),entry.getValue());send(post("/api/expenses"),admin,changed).andExpect(status().isConflict());}
        send(post("/api/expenses"),employee,r).andExpect(status().isConflict());
    }
    @Test void simultaneousPurchasesPreserveIncrementsAndChain()throws Exception{
        var statuses=concurrent(()->send(post("/api/purchases"),admin,purchase()).andReturn().getResponse().getStatus(),()->send(post("/api/purchases"),employee,purchase()).andReturn().getResponse().getStatus());assertEquals(List.of(201,201),statuses);
        assertEquals(25,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));assertEquals(List.of(5,15),jdbc.queryForList("select previous_stock from inventory_movements where product_id=? order by id",Integer.class,product));
    }
    @Test void simultaneousSamePurchaseReferenceAddsStockOnlyOnce()throws Exception{
        var r=purchase();assertEquals(List.of(201,201),concurrent(()->send(post("/api/purchases"),admin,r).andReturn().getResponse().getStatus(),()->send(post("/api/purchases"),admin,r).andReturn().getResponse().getStatus()));assertEquals(15,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
    }
    @Test void simultaneousExpenseReferenceHasOneRecord()throws Exception{
        var r=expense();var results=concurrent(()->send(post("/api/expenses"),admin,r).andReturn().getResponse().getStatus(),()->send(post("/api/expenses"),admin,r).andReturn().getResponse().getStatus());assertEquals(201,results.getFirst());assertTrue(results.getLast()==201||results.getLast()==409);assertEquals(1,jdbc.queryForObject("select count(*) from expenses where request_id=?",Integer.class,UUID.fromString((String)r.get("requestId"))));
    }
    List<Integer> concurrent(Callable<Integer> a,Callable<Integer> b)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);try(var pool=Executors.newFixedThreadPool(2)){var futures=new ArrayList<Future<Integer>>();for(var task:List.of(a,b))futures.add(pool.submit(()->{ready.countDown();assertTrue(start.await(10,TimeUnit.SECONDS));return task.call();}));assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();return java.util.stream.Stream.of(futures.get(0).get(25,TimeUnit.SECONDS),futures.get(1).get(25,TimeUnit.SECONDS)).sorted().toList();}
    }
    @Test void listsArePaginatedFilteredAndSharedBetweenRoles()throws Exception{
        var er=expense();er.put("description","Transporte "+actor);var pr=purchase();pr.put("supplierName","Proveedor "+actor);
        send(post("/api/expenses"),admin,er).andExpect(status().isCreated());send(post("/api/purchases"),employee,pr).andExpect(status().isCreated());
        for(String token:List.of(admin,employee)){
            send(get("/api/expenses").param("q","Transporte "+actor).param("category","TRANSPORT").param("from",today()).param("to",today()).param("size","1"),token,null).andExpect(status().isOk()).andExpect(jsonPath("total").value(1)).andExpect(jsonPath("items[0].amount").value("12.50"));
            send(get("/api/purchases").param("q","Proveedor "+actor).param("from",today()).param("to",today()).param("size","1"),token,null).andExpect(status().isOk()).andExpect(jsonPath("total").value(1));
            send(get("/api/expenses").param("q","%_"),token,null).andExpect(jsonPath("total").value(0));
        }
        for(String path:List.of("/api/expenses","/api/purchases")){send(get(path).param("page","-1"),admin,null).andExpect(status().isBadRequest());send(get(path).param("size","101"),admin,null).andExpect(status().isBadRequest());send(get(path).param("from","2026-12-31").param("to","2026-01-01"),admin,null).andExpect(status().isBadRequest());send(get(path+"/999999999"),admin,null).andExpect(status().isNotFound());}
    }
    @Test void onlyAdminCanEditNonfinancialDetails()throws Exception{
        long e=id(send(post("/api/expenses"),employee,expense()).andExpect(status().isCreated()));long p=id(send(post("/api/purchases"),employee,purchase()).andExpect(status().isCreated()));
        for(String path:List.of("/api/expenses/"+e,"/api/purchases/"+p)){
            send(put(path+"/details"),employee,Map.of("description","Corregido","notes","Nota")).andExpect(status().isForbidden());
            send(put(path+"/details"),admin,Map.of("description","Corregido","notes","Nota","total","1")).andExpect(status().isBadRequest());
            send(put(path+"/details"),admin,Map.of("description","Corregido","notes","Nota")).andExpect(status().isOk());
        }
        send(get("/api/expenses/"+e),employee,null).andExpect(jsonPath("amount").value("12.50")).andExpect(jsonPath("createdBy").isNumber());
        send(get("/api/purchases/"+p),employee,null).andExpect(jsonPath("purchase.total").value("25.00"));
    }
    @Test void summariesUseBusinessDateRatherThanCreationDate()throws Exception{
        var e=expense();e.put("expenseDate","2000-01-01");send(post("/api/expenses"),admin,e).andExpect(status().isCreated());
        var p=purchase();p.put("purchaseDate","2000-01-01");send(post("/api/purchases"),admin,p).andExpect(status().isCreated());
        // Other tests may have same-day records, so compare exact deltas for this request.
        var before=json.readTree(send(get("/api/expenses/summary"),admin,null).andReturn().getResponse().getContentAsString()).get("total").asText();
        send(post("/api/expenses"),admin,expense()).andExpect(status().isCreated());
        send(get("/api/expenses/summary"),employee,null).andExpect(status().isOk()).andExpect(jsonPath("total").value(new BigDecimal(before).add(new BigDecimal("12.50")).toPlainString())).andExpect(jsonPath("date").value(today()));
        send(get("/api/purchases/summary"),employee,null).andExpect(status().isOk()).andExpect(jsonPath("total").isString()).andExpect(jsonPath("date").value(today()));
    }
    @Test void purchaseConcurrentWithSaleUsesSameStockLock()throws Exception{
        var sale=Map.of("requestId",UUID.randomUUID().toString(),"paymentMethod","CASH","items",List.of(Map.of("productId",product,"quantity",2)));
        assertEquals(List.of(201,201),concurrent(()->send(post("/api/purchases"),admin,purchase()).andReturn().getResponse().getStatus(),()->send(post("/api/sales"),employee,sale).andReturn().getResponse().getStatus()));
        assertEquals(13,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));
        var chain=jdbc.queryForList("select previous_stock,new_stock from inventory_movements where product_id=? order by id",product);assertEquals(5,chain.getFirst().get("previous_stock"));assertEquals(chain.getFirst().get("new_stock"),chain.getLast().get("previous_stock"));assertEquals(13,chain.getLast().get("new_stock"));
    }
    @Test void purchaseAndAdjustmentKeepSerializedMovementChain()throws Exception{
        assertEquals(List.of(200,201),concurrent(()->send(post("/api/purchases"),admin,purchase()).andReturn().getResponse().getStatus(),()->send(post("/api/products/"+product+"/stock-adjustments"),admin,Map.of("newStock",20,"reason","Conteo de prueba")).andReturn().getResponse().getStatus()));
        var chain=jdbc.queryForList("select previous_stock,new_stock from inventory_movements where product_id=? order by id",product);assertEquals(5,chain.getFirst().get("previous_stock"));assertEquals(chain.getFirst().get("new_stock"),chain.getLast().get("previous_stock"));assertEquals(jdbc.queryForObject("select stock from products where id=?",Integer.class,product),chain.getLast().get("new_stock"));
    }
    @Test void reversedProductOrderDoesNotDeadlock()throws Exception{
        long other=jdbc.queryForObject("insert into products(name,sale_price,stock,minimum_stock,active,created_at,updated_at) values ('Otro',1,0,0,true,now(),now()) returning id",Long.class);
        var a=purchase();var b=purchase();var i=Map.of("productId",product,"quantity",1,"unitCost","1");var j=Map.of("productId",other,"quantity",1,"unitCost","2");a.put("items",List.of(i,j));b.put("items",List.of(j,i));
        assertEquals(List.of(201,201),concurrent(()->send(post("/api/purchases"),admin,a).andReturn().getResponse().getStatus(),()->send(post("/api/purchases"),employee,b).andReturn().getResponse().getStatus()));assertEquals(7,jdbc.queryForObject("select stock from products where id=?",Integer.class,product));assertEquals(2,jdbc.queryForObject("select stock from products where id=?",Integer.class,other));
    }
    @Test void disjointPurchaseReferenceCollisionCannotCreateTwoRecords()throws Exception{
        long other=jdbc.queryForObject("insert into products(name,sale_price,stock,minimum_stock,active,created_at,updated_at) values ('Otro',1,0,0,true,now(),now()) returning id",Long.class);
        var a=purchase();var b=new HashMap<>(a);b.put("items",List.of(Map.of("productId",other,"quantity",1,"unitCost","2")));
        assertEquals(List.of(201,409),concurrent(()->send(post("/api/purchases"),admin,a).andReturn().getResponse().getStatus(),()->send(post("/api/purchases"),admin,b).andReturn().getResponse().getStatus()));assertEquals(1,jdbc.queryForObject("select count(*) from purchases where request_id=?",Integer.class,UUID.fromString((String)a.get("requestId"))));
    }
    @Test void purchasePreservesCatalogCostAndRejectsInvalidMovementReferences()throws Exception{
        jdbc.update("update products set cost_price=7.77 where id=?",product);long p=id(send(post("/api/purchases"),admin,purchase()).andExpect(status().isCreated()));assertEquals(new BigDecimal("7.77"),jdbc.queryForObject("select cost_price from products where id=?",BigDecimal.class,product));
        for(String type:List.of("PURCHASE","SALE","ADJUSTMENT"))assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("insert into inventory_movements(product_id,type,quantity,previous_stock,new_stock,reason,created_by,created_at,purchase_id) values (?,?,-1,15,14,'invalido',?,now(),?)",product,type,actor,p));
    }
}
