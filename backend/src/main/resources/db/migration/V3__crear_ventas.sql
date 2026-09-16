CREATE TABLE sales (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    request_fingerprint VARCHAR(64) NOT NULL,
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0 AND total <= 999999999999.99),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH','YAPE','PLIN','TRANSFER')),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX sales_created_idx ON sales(created_at DESC, id DESC);
CREATE TABLE sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name_snapshot VARCHAR(160) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0 AND unit_price <= 99999999.99),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0 AND subtotal <= 999999999999.99),
    UNIQUE(sale_id, product_id),
    CHECK (subtotal = unit_price * quantity)
);
ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check CHECK (type IN ('INITIAL','ADJUSTMENT','SALE'));
ALTER TABLE inventory_movements ADD COLUMN sale_id BIGINT REFERENCES sales(id);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movement_sale_reference CHECK (
    (type = 'SALE' AND sale_id IS NOT NULL AND quantity < 0) OR
    (type <> 'SALE' AND sale_id IS NULL)
);
CREATE UNIQUE INDEX inventory_sale_product_idx ON inventory_movements(sale_id, product_id);
