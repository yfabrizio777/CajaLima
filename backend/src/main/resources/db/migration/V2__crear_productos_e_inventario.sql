CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL CHECK (length(btrim(name)) > 0),
    sku VARCHAR(64) UNIQUE CHECK (sku IS NULL OR (sku = upper(btrim(sku)) AND sku ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$')),
    sale_price NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0 AND sale_price <= 99999999.99),
    cost_price NUMERIC(10,2) CHECK (cost_price >= 0 AND cost_price <= 99999999.99),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 1000000),
    minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock BETWEEN 0 AND 1000000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('INITIAL', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN -1000000 AND 1000000 AND quantity <> 0),
    previous_stock INTEGER NOT NULL CHECK (previous_stock BETWEEN 0 AND 1000000),
    new_stock INTEGER NOT NULL CHECK (new_stock BETWEEN 0 AND 1000000),
    reason VARCHAR(240) NOT NULL CHECK (length(btrim(reason)) > 0),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK (quantity = new_stock - previous_stock),
    CHECK (type <> 'INITIAL' OR (previous_stock = 0 AND new_stock > 0))
);
CREATE INDEX inventory_movements_product_created_idx ON inventory_movements(product_id, created_at DESC);
CREATE INDEX products_active_id_idx ON products(active, id);
