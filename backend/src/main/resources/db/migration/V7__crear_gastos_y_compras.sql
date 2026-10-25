CREATE TABLE expenses (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    request_fingerprint VARCHAR(64) NOT NULL,
    description VARCHAR(160) NOT NULL CHECK (length(btrim(description)) > 0),
    category VARCHAR(20) NOT NULL CHECK (category IN ('RENT','SERVICES','TRANSPORT','SUPPLIES','MAINTENANCE','OTHER')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999999.99),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH','YAPE','PLIN','TRANSFER')),
    expense_date DATE NOT NULL CHECK (expense_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
    notes VARCHAR(500),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX expenses_date_id_idx ON expenses(expense_date DESC,id DESC);
CREATE TABLE purchases (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    request_fingerprint VARCHAR(64) NOT NULL,
    description VARCHAR(160) NOT NULL CHECK (length(btrim(description)) > 0),
    supplier_name VARCHAR(160),
    total NUMERIC(14,2) NOT NULL CHECK (total > 0 AND total <= 999999999999.99),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH','YAPE','PLIN','TRANSFER')),
    purchase_date DATE NOT NULL CHECK (purchase_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
    notes VARCHAR(500),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX purchases_date_id_idx ON purchases(purchase_date DESC,id DESC);
CREATE TABLE purchase_items (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name_snapshot VARCHAR(160) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
    unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost > 0 AND unit_cost <= 99999999.99),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal > 0 AND subtotal <= 999999999999.99),
    UNIQUE(purchase_id, product_id),
    CHECK (subtotal = unit_cost * quantity)
);
ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check CHECK (type IN ('INITIAL','ADJUSTMENT','SALE','PURCHASE'));
ALTER TABLE inventory_movements ADD COLUMN purchase_id BIGINT REFERENCES purchases(id);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movement_purchase_reference CHECK (
    (type='PURCHASE' AND purchase_id IS NOT NULL AND sale_id IS NULL AND quantity > 0) OR
    (type<>'PURCHASE' AND purchase_id IS NULL)
);
CREATE UNIQUE INDEX inventory_purchase_product_idx ON inventory_movements(purchase_id, product_id);
