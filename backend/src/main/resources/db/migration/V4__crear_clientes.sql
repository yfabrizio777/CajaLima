CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL CHECK (length(btrim(name)) > 0),
    document_type VARCHAR(10) CHECK (document_type IN ('DNI', 'RUC', 'CE', 'OTHER')),
    document_number VARCHAR(32),
    phone VARCHAR(32),
    email VARCHAR(180),
    address VARCHAR(240),
    notes VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK (document_number IS NULL OR
        (document_type IS NOT NULL AND document_number ~ '^[A-Z0-9][A-Z0-9./-]{0,31}$')),
    CHECK (document_number IS NULL OR document_type <> 'DNI' OR document_number ~ '^[0-9]{8}$'),
    CHECK (document_number IS NULL OR document_type <> 'RUC' OR document_number ~ '^[0-9]{11}$'),
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{1,20}$')
);
CREATE UNIQUE INDEX customers_document_unique ON customers(document_type, document_number)
    WHERE document_number IS NOT NULL;
CREATE INDEX customers_name_id_idx ON customers(name, id);
