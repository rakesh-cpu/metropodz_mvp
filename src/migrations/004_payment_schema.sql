-- Migration: 004_payment_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. PAYMENT PROVIDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_providers (
    id SERIAL PRIMARY KEY,
    provider_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(50) NOT NULL UNIQUE, -- cashfree, razorpay, stripe, etc.
    provider_config JSONB NOT NULL, -- API keys, endpoints, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    supported_countries VARCHAR(3)[] DEFAULT ARRAY['IND'], -- ISO 3166-1 alpha-3
    supported_currencies VARCHAR(3)[] DEFAULT ARRAY['INR'], -- ISO 4217
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. PAYMENT ORDERS TABLE (Enhanced)
-- ==========================================
CREATE TYPE order_status_enum AS ENUM (
    'created',      -- Order created, awaiting payment
    'active',       -- Payment session active
    'paid',         -- Payment successful
    'expired',      -- Order expired
    'cancelled',    -- Order cancelled
    'partially_refunded', -- Partial refund issued
    'fully_refunded'      -- Full refund issued
);

CREATE TABLE IF NOT EXISTS payment_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL UNIQUE, -- External order ID (CF_ORDER_xxxx)
    internal_order_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Relationships
    user_id UUID NOT NULL, -- References users(user_id)
    booking_id UUID, -- References bookings(booking_id) - nullable for non-booking payments
    provider_id UUID NOT NULL, -- References payment_providers(provider_id)
    
    -- Order Details
    order_amount DECIMAL(12,2) NOT NULL CHECK (order_amount > 0),
    order_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    order_status order_status_enum NOT NULL DEFAULT 'created',
    
    -- Provider Details
    provider_order_id VARCHAR(200), -- Cashfree's cf_order_id
    payment_session_id VARCHAR(500), -- For frontend integration
    
    -- Customer Information
    customer_details JSONB NOT NULL, -- {name, email, phone, address}
    
    -- Order Metadata
    order_note TEXT,
    order_tags JSONB, -- Flexible tags for categorization
    order_meta JSONB, -- return_url, notify_url, etc.
    
    -- Business Logic
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    convenience_fee DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(12,2) GENERATED ALWAYS AS (
        order_amount + COALESCE(tax_amount, 0) + COALESCE(convenience_fee, 0) - COALESCE(discount_amount, 0)
    ) STORED,
    
    -- Timestamps
    order_expiry_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_orders_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id),
    CONSTRAINT fk_payment_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_orders_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
);

-- ==========================================
-- 3. PAYMENT TRANSACTIONS TABLE (Enhanced)
-- ==========================================
CREATE TYPE payment_status_enum AS ENUM (
    'initiated',    -- Payment initiated
    'pending',      -- Payment in progress
    'success',      -- Payment successful
    'failed',       -- Payment failed
    'cancelled',    -- Payment cancelled by user
    'timeout',      -- Payment timeout
    'user_dropped'  -- User abandoned payment
);

CREATE TYPE payment_method_enum AS ENUM (
    'upi',
    'card',
    'netbanking',
    'wallet',
    'emi',
    'cardless_emi',
    'paylater',
    'bank_transfer',
    'cash',
    'other'
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Relationships
    order_id VARCHAR(100) NOT NULL, -- References payment_orders(order_id)
    provider_id UUID NOT NULL,
    
    -- Provider Transaction Details
    provider_payment_id VARCHAR(200), -- cf_payment_id from Cashfree
    provider_transaction_id VARCHAR(200), -- Bank/Gateway transaction ID
    
    -- Transaction Details
    transaction_amount DECIMAL(12,2) NOT NULL,
    transaction_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_status payment_status_enum NOT NULL DEFAULT 'initiated',
    payment_method payment_method_enum,
    payment_method_details JSONB, -- Card details, UPI handle, etc.
    
    -- Gateway Details
    gateway_name VARCHAR(100),
    gateway_transaction_id VARCHAR(200),
    bank_reference_number VARCHAR(200),
    auth_id_code VARCHAR(100),
    rrn VARCHAR(50), -- Retrieval Reference Number
    
    -- Settlement Details
    settlement_amount DECIMAL(12,2),
    settlement_currency VARCHAR(3),
    gateway_fee DECIMAL(10,2),
    gateway_tax DECIMAL(10,2),
    
    -- Transaction Messages
    payment_message TEXT,
    failure_reason TEXT,
    gateway_response JSONB,
    
    -- Security & Fraud
    risk_score DECIMAL(5,2),
    fraud_details JSONB,
    
    -- Timestamps
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gateway_settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_transactions_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_transactions_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id)
);

-- ==========================================
-- 4. PAYMENT REFUNDS TABLE (Enhanced)
-- ==========================================
CREATE TYPE refund_status_enum AS ENUM (
    'initiated',
    'pending',
    'processed',
    'successful',
    'failed',
    'cancelled'
);

CREATE TYPE refund_type_enum AS ENUM (
    'full',
    'partial',
    'cancellation',
    'dispute',
    'goodwill'
);

CREATE TABLE IF NOT EXISTS payment_refunds (
    id SERIAL PRIMARY KEY,
    refund_id VARCHAR(100) NOT NULL UNIQUE, -- Business refund ID
    internal_refund_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Relationships
    order_id VARCHAR(100) NOT NULL,
    transaction_id UUID, -- Original successful transaction
    provider_id UUID NOT NULL,
    
    -- Provider Details
    provider_refund_id VARCHAR(200), -- cf_refund_id from Cashfree
    
    -- Refund Details
    refund_amount DECIMAL(12,2) NOT NULL CHECK (refund_amount > 0),
    refund_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    refund_type refund_type_enum NOT NULL DEFAULT 'full',
    refund_status refund_status_enum NOT NULL DEFAULT 'initiated',
    
    -- Business Details
    refund_reason TEXT,
    refund_note TEXT,
    requested_by UUID, -- References users(user_id) - admin/system user who initiated
    
    -- Gateway Details
    gateway_refund_id VARCHAR(200),
    bank_reference_number VARCHAR(200),
    refund_arn VARCHAR(100), -- Acquirer Reference Number
    
    -- Settlement Details
    gateway_fee DECIMAL(10,2) DEFAULT 0.00,
    settlement_amount DECIMAL(12,2),
    settlement_currency VARCHAR(3),
    
    -- Processing Details
    refund_speed VARCHAR(20) DEFAULT 'STANDARD', -- INSTANT, STANDARD
    expected_settlement_date DATE,
    actual_settlement_date DATE,
    
    -- Provider Response
    provider_response JSONB,
    failure_reason TEXT,
    
    -- Timestamps
    refund_initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refund_processed_at TIMESTAMPTZ,
    refund_settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_refunds_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_refunds_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id),
    CONSTRAINT fk_payment_refunds_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id),
    CONSTRAINT fk_payment_refunds_requested_by FOREIGN KEY (requested_by) REFERENCES users(user_id)
);

-- ==========================================
-- 5. PAYMENT LINKS TABLE
-- ==========================================
CREATE TYPE link_status_enum AS ENUM (
    'active',
    'paid',
    'expired',
    'cancelled',
    'inactive'
);

CREATE TABLE IF NOT EXISTS payment_links (
    id SERIAL PRIMARY KEY,
    link_id VARCHAR(100) NOT NULL UNIQUE, -- Business link ID
    internal_link_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Relationships
    created_by_user_id UUID NOT NULL, -- Who created the link
    order_id VARCHAR(100), -- Associated order (if any)
    provider_id UUID NOT NULL,
    
    -- Link Details
    link_url TEXT NOT NULL,
    link_purpose TEXT NOT NULL,
    link_amount DECIMAL(12,2) NOT NULL CHECK (link_amount > 0),
    link_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    link_status link_status_enum NOT NULL DEFAULT 'active',
    
    -- Customer Details
    customer_details JSONB, -- {name, email, phone}
    
    -- Configuration
    link_notes JSONB,
    link_meta JSONB, -- return_url, notify_url, theme, etc.
    
    -- Expiry & Limits
    link_expiry_time TIMESTAMPTZ,
    usage_limit INTEGER DEFAULT 1, -- How many times link can be used
    usage_count INTEGER DEFAULT 0, -- How many times it's been used
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_paid_at TIMESTAMPTZ,
    last_paid_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_payment_links_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_payment_links_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id),
    CONSTRAINT fk_payment_links_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id),
    CONSTRAINT chk_usage_count_limit CHECK (usage_count <= usage_limit)
);

-- ==========================================
-- 6. PAYMENT WEBHOOKS LOG TABLE
-- ==========================================
CREATE TYPE webhook_status_enum AS ENUM (
    'received',
    'processing',
    'processed',
    'failed',
    'ignored'
);

CREATE TABLE IF NOT EXISTS payment_webhooks (
    id SERIAL PRIMARY KEY,
    webhook_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Provider Details
    provider_id UUID NOT NULL,
    provider_webhook_id VARCHAR(200), -- event_id from provider
    
    -- Webhook Details
    event_type VARCHAR(100) NOT NULL, -- PAYMENT_SUCCESS_WEBHOOK, etc.
    webhook_data JSONB NOT NULL, -- Complete webhook payload
    webhook_signature VARCHAR(1000),
    webhook_timestamp TIMESTAMPTZ,
    
    -- Related Entities
    order_id VARCHAR(100),
    transaction_id UUID,
    refund_id VARCHAR(100),
    
    -- Processing Status
    webhook_status webhook_status_enum NOT NULL DEFAULT 'received',
    processing_attempts INTEGER DEFAULT 0,
    processing_error TEXT,
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_webhooks_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id),
    CONSTRAINT fk_payment_webhooks_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id),
    CONSTRAINT fk_payment_webhooks_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id)
);

-- ==========================================
-- 7. PAYMENT AUDIT TRAIL TABLE
-- ==========================================
CREATE TYPE audit_action_enum AS ENUM (
    'order_created',
    'order_updated',
    'payment_initiated',
    'payment_success',
    'payment_failed',
    'refund_initiated',
    'refund_processed',
    'webhook_received',
    'webhook_processed',
    'status_changed'
);

CREATE TABLE IF NOT EXISTS payment_audit_trail (
    id SERIAL PRIMARY KEY,
    audit_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Entity References
    order_id VARCHAR(100),
    transaction_id UUID,
    refund_id VARCHAR(100),
    
    -- Audit Details
    action audit_action_enum NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- order, transaction, refund, webhook
    entity_id VARCHAR(200) NOT NULL, -- ID of the entity being audited
    
    -- Change Details
    old_data JSONB,
    new_data JSONB,
    changes JSONB, -- Specific fields that changed
    
    -- Context
    triggered_by VARCHAR(100), -- user_id, system, webhook, etc.
    trigger_source VARCHAR(100), -- api, webhook, admin_panel, etc.
    user_agent TEXT,
    ip_address INET,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_audit_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id),
    CONSTRAINT fk_payment_audit_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id)
);

-- ==========================================
-- 8. PAYMENT DISPUTES TABLE
-- ==========================================
CREATE TYPE dispute_status_enum AS ENUM (
    'open',
    'under_review',
    'waiting_for_response',
    'resolved',
    'lost',
    'won',
    'closed'
);

CREATE TYPE dispute_type_enum AS ENUM (
    'chargeback',
    'inquiry',
    'fraud',
    'authorization',
    'processing_error',
    'other'
);

CREATE TABLE IF NOT EXISTS payment_disputes (
    id SERIAL PRIMARY KEY,
    dispute_id VARCHAR(100) NOT NULL UNIQUE,
    internal_dispute_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Relationships
    order_id VARCHAR(100) NOT NULL,
    transaction_id UUID,
    provider_id UUID NOT NULL,
    
    -- Dispute Details
    provider_dispute_id VARCHAR(200),
    dispute_type dispute_type_enum NOT NULL,
    dispute_status dispute_status_enum NOT NULL DEFAULT 'open',
    dispute_amount DECIMAL(12,2) NOT NULL,
    dispute_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    
    -- Details
    dispute_reason TEXT,
    dispute_evidence JSONB, -- Documents, proofs, etc.
    customer_complaint TEXT,
    
    -- Resolution
    resolution_note TEXT,
    resolution_amount DECIMAL(12,2),
    resolved_by UUID, -- admin user who resolved
    
    -- Important Dates
    dispute_date DATE NOT NULL,
    response_due_date DATE,
    resolved_at TIMESTAMPTZ,
    
    -- Provider Data
    provider_response JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_disputes_order FOREIGN KEY (order_id) REFERENCES payment_orders(order_id),
    CONSTRAINT fk_payment_disputes_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id),
    CONSTRAINT fk_payment_disputes_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id),
    CONSTRAINT fk_payment_disputes_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id)
);

-- ==========================================
-- 9. PAYMENT SETTLEMENTS TABLE
-- ==========================================
CREATE TYPE settlement_status_enum AS ENUM (
    'pending',
    'processing',
    'settled',
    'failed',
    'on_hold'
);

CREATE TABLE IF NOT EXISTS payment_settlements (
    id SERIAL PRIMARY KEY,
    settlement_id VARCHAR(100) NOT NULL UNIQUE,
    internal_settlement_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    
    -- Provider Details
    provider_id UUID NOT NULL,
    provider_settlement_id VARCHAR(200),
    
    -- Settlement Details
    settlement_amount DECIMAL(15,2) NOT NULL,
    settlement_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    settlement_status settlement_status_enum NOT NULL DEFAULT 'pending',
    
    -- Date Range
    settlement_date DATE NOT NULL,
    settlement_from_date DATE NOT NULL,
    settlement_to_date DATE NOT NULL,
    
    -- Financial Breakdown
    gross_amount DECIMAL(15,2) NOT NULL,
    total_fees DECIMAL(12,2) DEFAULT 0.00,
    total_tax DECIMAL(12,2) DEFAULT 0.00,
    total_refunds DECIMAL(12,2) DEFAULT 0.00,
    total_chargebacks DECIMAL(12,2) DEFAULT 0.00,
    adjustments DECIMAL(12,2) DEFAULT 0.00,
    
    -- Bank Details
    settlement_bank_account VARCHAR(100),
    settlement_reference_number VARCHAR(200),
    settlement_utr VARCHAR(100), -- Unique Transaction Reference
    
    -- Metadata
    transaction_count INTEGER DEFAULT 0,
    settlement_report_url TEXT,
    provider_response JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_payment_settlements_provider FOREIGN KEY (provider_id) REFERENCES payment_providers(provider_id)
);

-- ==========================================
-- 10. INDEXES FOR OPTIMAL PERFORMANCE
-- ==========================================

-- Payment Orders Indexes
CREATE INDEX idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX idx_payment_orders_booking_id ON payment_orders(booking_id);
CREATE INDEX idx_payment_orders_provider_id ON payment_orders(provider_id);
CREATE INDEX idx_payment_orders_status ON payment_orders(order_status);
CREATE INDEX idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX idx_payment_orders_order_amount ON payment_orders(order_amount);

-- Payment Transactions Indexes
CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_provider_payment_id ON payment_transactions(provider_payment_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(payment_status);
CREATE INDEX idx_payment_transactions_method ON payment_transactions(payment_method);
CREATE INDEX idx_payment_transactions_time ON payment_transactions(transaction_time);

-- Payment Refunds Indexes
CREATE INDEX idx_payment_refunds_order_id ON payment_refunds(order_id);
CREATE INDEX idx_payment_refunds_status ON payment_refunds(refund_status);
CREATE INDEX idx_payment_refunds_created_at ON payment_refunds(created_at);

-- Payment Webhooks Indexes
CREATE INDEX idx_payment_webhooks_provider_id ON payment_webhooks(provider_id);
CREATE INDEX idx_payment_webhooks_order_id ON payment_webhooks(order_id);
CREATE INDEX idx_payment_webhooks_status ON payment_webhooks(webhook_status);
CREATE INDEX idx_payment_webhooks_received_at ON payment_webhooks(received_at);
CREATE INDEX idx_payment_webhooks_event_type ON payment_webhooks(event_type);

-- Payment Audit Trail Indexes
CREATE INDEX idx_payment_audit_order_id ON payment_audit_trail(order_id);
CREATE INDEX idx_payment_audit_entity_type ON payment_audit_trail(entity_type);
CREATE INDEX idx_payment_audit_action ON payment_audit_trail(action);
CREATE INDEX idx_payment_audit_created_at ON payment_audit_trail(created_at);

-- Composite Indexes for Common Queries
CREATE INDEX idx_payment_orders_user_status ON payment_orders(user_id, order_status);
CREATE INDEX idx_payment_transactions_order_status ON payment_transactions(order_id, payment_status);
CREATE INDEX idx_payment_webhooks_order_status ON payment_webhooks(order_id, webhook_status);

-- ==========================================
-- 11. TRIGGERS FOR AUTO-UPDATED TIMESTAMPS
-- ==========================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_payment_orders_updated_at BEFORE UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_refunds_updated_at BEFORE UPDATE ON payment_refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON payment_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_disputes_updated_at BEFORE UPDATE ON payment_disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_settlements_updated_at BEFORE UPDATE ON payment_settlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 12. INITIAL DATA SEEDING
-- ==========================================

-- Insert default payment provider (Cashfree)
INSERT INTO payment_providers (provider_name, provider_config, is_active, is_default) 
VALUES (
    'cashfree',
    '{"client_id": "", "client_secret": "", "base_url": "https://sandbox.cashfree.com/pg", "webhook_secret": ""}',
    true,
    true
) ON CONFLICT (provider_name) DO NOTHING;

-- ==========================================
-- 13. VIEWS FOR COMMON QUERIES
-- ==========================================

-- Payment Summary View
CREATE VIEW payment_order_summary AS
SELECT 
    po.order_id,
    po.internal_order_id,
    po.user_id,
    po.booking_id,
    po.order_amount,
    po.order_status,
    pt.payment_status,
    pt.payment_method,
    pt.transaction_time,
    pp.provider_name,
    po.created_at,
    po.updated_at
FROM payment_orders po
LEFT JOIN payment_transactions pt ON po.order_id = pt.order_id AND pt.payment_status = 'success'
JOIN payment_providers pp ON po.provider_id = pp.provider_id;

-- User Payment History View
CREATE VIEW user_payment_history AS
SELECT 
    po.user_id,
    po.order_id,
    po.booking_id,
    po.order_amount,
    po.order_status,
    pt.payment_status,
    pt.payment_method,
    pt.transaction_time,
    b.check_in,
    b.check_out,
    po.created_at
FROM payment_orders po
LEFT JOIN payment_transactions pt ON po.order_id = pt.order_id
LEFT JOIN bookings b ON po.booking_id = b.booking_id
ORDER BY po.created_at DESC;

-- ==========================================
-- 14. SECURITY POLICIES (ROW LEVEL SECURITY)
-- ==========================================

-- Enable RLS on sensitive tables
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payment orders
CREATE POLICY payment_orders_user_policy ON payment_orders 
FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);

-- ==========================================
-- 15. FUNCTIONS FOR BUSINESS LOGIC
-- ==========================================

-- Function to calculate refund amount limits
CREATE OR REPLACE FUNCTION get_max_refundable_amount(p_order_id VARCHAR(100))
RETURNS DECIMAL(12,2) AS $$
DECLARE
    original_amount DECIMAL(12,2);
    refunded_amount DECIMAL(12,2);
BEGIN
    -- Get original order amount
    SELECT order_amount INTO original_amount
    FROM payment_orders WHERE order_id = p_order_id;
    
    -- Get total refunded amount
    SELECT COALESCE(SUM(refund_amount), 0) INTO refunded_amount
    FROM payment_refunds 
    WHERE order_id = p_order_id AND refund_status IN ('successful', 'processed');
    
    RETURN GREATEST(0, original_amount - refunded_amount);
END;
$$ LANGUAGE plpgsql;

-- Function to check if booking can be cancelled for refund
CREATE OR REPLACE FUNCTION can_cancel_booking_for_refund(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    checkin_time TIMESTAMPTZ;
    cancellation_window INTERVAL := '2 hours';
BEGIN
    SELECT check_in INTO checkin_time
    FROM bookings WHERE booking_id = p_booking_id;
    
    RETURN (checkin_time - NOW()) > cancellation_window;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE payment_providers IS 'Configuration for different payment providers (Cashfree, Razorpay, etc.)';
COMMENT ON TABLE payment_orders IS 'Main payment orders table linking users, bookings and payment providers';
COMMENT ON TABLE payment_transactions IS 'Individual payment transactions with gateway details';
COMMENT ON TABLE payment_refunds IS 'Refund transactions for cancelled or disputed payments';
COMMENT ON TABLE payment_links IS 'Shareable payment links for easy payments';
COMMENT ON TABLE payment_webhooks IS 'Log of all webhook events received from payment providers';
COMMENT ON TABLE payment_audit_trail IS 'Complete audit trail of all payment-related actions';
COMMENT ON TABLE payment_disputes IS 'Chargebacks and disputes from customers';
COMMENT ON TABLE payment_settlements IS 'Settlement reports from payment providers';

COMMENT ON COLUMN payment_orders.net_amount IS 'Calculated field: order_amount + tax + fees - discount';
COMMENT ON COLUMN payment_transactions.rrn IS 'Retrieval Reference Number from bank';
COMMENT ON COLUMN payment_refunds.refund_arn IS 'Acquirer Reference Number for refund tracking';
