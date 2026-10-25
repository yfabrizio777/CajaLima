ALTER TABLE sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('CASH','YAPE','PLIN','TRANSFER','CREDIT'));
ALTER TABLE sales ADD CONSTRAINT sales_credit_customer_check CHECK (payment_method <> 'CREDIT' OR (customer_id IS NOT NULL AND total > 0));
-- The composite FK below ensures the credit matches its sale, customer, amount and actor.
ALTER TABLE sales ADD CONSTRAINT sales_credit_reference_unique UNIQUE (id, customer_id, total, created_by, payment_method);
CREATE TABLE customer_account_movements (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    sale_id BIGINT UNIQUE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('CREDIT','PAYMENT')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 999999999999.99),
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH','YAPE','PLIN','TRANSFER')),
    sale_payment_method VARCHAR(20),
    note VARCHAR(240),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_id UUID UNIQUE,
    request_fingerprint VARCHAR(64),
    FOREIGN KEY (sale_id, customer_id, amount, created_by, sale_payment_method)
        REFERENCES sales(id, customer_id, total, created_by, payment_method),
    CHECK (
        (type='CREDIT' AND sale_id IS NOT NULL AND sale_payment_method IS NOT NULL AND sale_payment_method='CREDIT' AND payment_method IS NULL AND request_id IS NULL AND request_fingerprint IS NULL) OR
        (type='PAYMENT' AND sale_id IS NULL AND sale_payment_method IS NULL AND payment_method IS NOT NULL AND request_id IS NOT NULL AND request_fingerprint IS NOT NULL)
    )
);
CREATE INDEX account_customer_created_idx ON customer_account_movements(customer_id, created_at DESC, id DESC);
