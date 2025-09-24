-- migrations/add-verification-system.sql

-- Add verification column to users table
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Create verification status enum
CREATE TYPE verification_status_enum AS ENUM (
    'pending',
    'in_progress', 
    'verified',
    'rejected',
    'expired'
);

-- Create verification table
CREATE TABLE IF NOT EXISTS user_verification (
    id SERIAL PRIMARY KEY,
    verification_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Aadhar Details
    aadhar_number VARCHAR(12),
    aadhar_ref_id VARCHAR(100), -- Cashfree reference ID
    aadhar_otp_generated_at TIMESTAMPTZ,
    aadhar_verified_at TIMESTAMPTZ,
    
    -- Verified Aadhar Data (from Cashfree response)
    verified_name VARCHAR(255),
    verified_dob DATE,
    verified_gender VARCHAR(10),
    verified_email VARCHAR(128),
    verified_address TEXT,
    verified_care_of VARCHAR(255),
    verified_pincode VARCHAR(10),
    verified_state VARCHAR(100),
    verified_district VARCHAR(100),
    year_of_birth INTEGER,
    mobile_hash VARCHAR(255),
    share_code VARCHAR(100),
    
    -- Image URLs (S3 paths)
    selfie_image_url TEXT,
    aadhar_image_url TEXT,
    
    -- Verification Status
    verification_status verification_status_enum DEFAULT 'pending',
    verification_notes TEXT,
    admin_remarks TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Constraints
    CONSTRAINT fk_user_verification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_aadhar_number_length CHECK (LENGTH(aadhar_number) = 12)
);

-- Create indexes
CREATE INDEX idx_user_verification_user_id ON user_verification(user_id);
CREATE INDEX idx_user_verification_status ON user_verification(verification_status);
CREATE INDEX idx_user_verification_aadhar_ref_id ON user_verification(aadhar_ref_id);
CREATE INDEX idx_user_verification_created_at ON user_verification(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_user_verification_updated_at 
    BEFORE UPDATE ON user_verification 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user verification status
CREATE OR REPLACE FUNCTION update_user_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update users table when verification is completed
    IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
        UPDATE users SET is_verified = TRUE WHERE user_id = NEW.user_id;
        NEW.verified_at = NOW();
    ELSIF NEW.verification_status != 'verified' THEN
        UPDATE users SET is_verified = FALSE WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic user update
CREATE TRIGGER trigger_update_user_verification_status
    BEFORE UPDATE ON user_verification
    FOR EACH ROW
    EXECUTE FUNCTION update_user_verification_status();




-- -- Simple verification table
-- CREATE TABLE IF NOT EXISTS user_verification (
--     id SERIAL PRIMARY KEY,
--     verification_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
--     user_id UUID NOT NULL,
    
--     -- Aadhar Details
--     aadhar_number VARCHAR(12),
--     aadhar_ref_id VARCHAR(100),
--     aadhar_verified_at TIMESTAMPTZ,
    
--     -- Verified Data
--     verified_name VARCHAR(255),
--     verified_dob DATE,
--     verified_address TEXT,
    
--     -- Simple Image URLs (direct S3 public URLs)
--     selfie_image_url TEXT,
--     aadhar_image_url TEXT,
    
--     -- Simple Status
--     verification_status VARCHAR(20) DEFAULT 'pending', -- pending, verified, rejected
    
--     -- Timestamps
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
--     CONSTRAINT fk_user_verification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
-- );

-- -- Add verification status to users table
-- ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
