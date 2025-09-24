
CREATE TYPE otp_type_enum AS ENUM ('login', 'registration', 'password_reset', 'phone_verification');
CREATE TYPE otp_status_enum AS ENUM ('pending', 'verified', 'expired', 'failed');
CREATE TYPE otp_delivery_method_enum AS ENUM ('sms', 'email');


CREATE TABLE IF NOT EXISTS otp_requests (
    id SERIAL PRIMARY KEY,
    otp_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    user_id UUID, 
    phone_number VARCHAR(15),
    email VARCHAR(128),
    country_code VARCHAR(16),
    internationalized_phone_number VARCHAR(64),
    otp_code VARCHAR(10) NOT NULL,
    otp_type otp_type_enum NOT NULL,
    otp_status otp_status_enum NOT NULL DEFAULT 'pending',
    delivery_method otp_delivery_method_enum NOT NULL,
    attempts_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    provider_response JSONB, -- SMS Country or email provider response
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS otp_delivery_logs (
    id SERIAL PRIMARY KEY,
    otp_request_id INTEGER REFERENCES otp_requests(id) ON DELETE CASCADE,
    delivery_method otp_delivery_method_enum NOT NULL,
    recipient VARCHAR(128) NOT NULL, -- phone or email
    provider_name VARCHAR(50) NOT NULL, -- 'sms_country', 'twilio', etc.
    provider_message_id VARCHAR(200),
    delivery_status VARCHAR(50), -- 'sent', 'delivered', 'failed', etc.
    provider_response JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT
);


CREATE INDEX idx_otp_requests_phone ON otp_requests(phone_number);
-- CREATE INDEX idx_otp_requests_email ON otp_requests(email);
-- CREATE INDEX idx_otp_requests_user_id ON otp_requests(user_id);
-- CREATE INDEX idx_otp_requests_expires_at ON otp_requests(expires_at);
-- CREATE INDEX idx_otp_requests_status ON otp_requests(otp_status);
-- CREATE INDEX idx_otp_requests_created_at ON otp_requests(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_otp_requests_updated_at 
    BEFORE UPDATE ON otp_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
