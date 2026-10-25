package pe.com.fabrizio.cajalima.purchase;
import jakarta.persistence.*;
import java.math.BigDecimal;
@Entity @Table(name="purchase_items")
public class PurchaseItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(name="purchase_id",nullable=false,updatable=false) Long purchaseId;
    @Column(name="product_id",nullable=false,updatable=false) Long productId;
    @Column(name="product_name_snapshot",nullable=false,updatable=false,length=160) String productName;
    @Column(nullable=false,updatable=false) int quantity;
    @Column(name="unit_cost",nullable=false,updatable=false,precision=10,scale=2) BigDecimal unitCost;
    @Column(nullable=false,updatable=false,precision=14,scale=2) BigDecimal subtotal;
    protected PurchaseItem(){}
    PurchaseItem(Long purchaseId,Long productId,String name,int quantity,BigDecimal unitCost){this.purchaseId=purchaseId;this.productId=productId;productName=name;this.quantity=quantity;this.unitCost=unitCost;subtotal=unitCost.multiply(BigDecimal.valueOf(quantity));}
}
