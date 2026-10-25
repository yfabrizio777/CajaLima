ALTER TABLE sales ADD COLUMN customer_id BIGINT NULL REFERENCES customers(id);
CREATE INDEX sales_customer_created_idx ON sales(customer_id, created_at DESC, id DESC)
    WHERE customer_id IS NOT NULL;
