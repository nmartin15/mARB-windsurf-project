-- =============================================================================
-- mARB Health — Canonical Database Schema
-- =============================================================================
-- Replaces all prior migrations. This is the single source of truth for the
-- database structure, aligned with real EDI 837P/837I/835 data.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ORGANIZATIONS (multi-tenancy ready)
-- =============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    npi             VARCHAR(10),
    tax_id          VARCHAR(15),
    org_type        VARCHAR(30) NOT NULL DEFAULT 'physician_practice'
                    CHECK (org_type IN ('physician_practice', 'hospital', 'health_system')),
    address_line1   VARCHAR(255),
    address_city    VARCHAR(100),
    address_state   VARCHAR(2),
    address_zip     VARCHAR(10),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. CLAIM HEADERS — one row per claim from 837P or 837I CLM segment
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_headers (
    id                              SERIAL PRIMARY KEY,
    org_id                          INTEGER REFERENCES organizations(id),
    claim_id                        VARCHAR(50) NOT NULL,
    claim_type                      VARCHAR(15) NOT NULL DEFAULT 'professional'
                                    CHECK (claim_type IN ('professional', 'institutional')),
    file_name                       VARCHAR(255),
    file_type                       VARCHAR(10) CHECK (file_type IN ('837P', '837I', NULL)),

    -- Charge / payment amounts
    total_charge_amount             DECIMAL(12,2),
    paid_amount                     DECIMAL(12,2),
    allowed_amount                  DECIMAL(12,2),
    patient_responsibility          DECIMAL(12,2),

    -- Claim status
    claim_status                    VARCHAR(20) NOT NULL DEFAULT 'submitted'
                                    CHECK (claim_status IN (
                                        'submitted', 'accepted', 'rejected',
                                        'denied', 'partial', 'paid', 'appealed'
                                    )),

    -- CLM segment fields
    facility_type_code              VARCHAR(10),
    facility_type_desc              VARCHAR(100),
    facility_code_qualifier         VARCHAR(10),
    facility_code_qualifier_desc    VARCHAR(100),
    claim_frequency_type_code       VARCHAR(10),
    claim_frequency_type_desc       VARCHAR(100),
    place_of_service_code           VARCHAR(10),
    place_of_service_desc           VARCHAR(100),

    -- Assignment / benefits
    assignment_code                 VARCHAR(10),
    assignment_desc                 VARCHAR(100),
    benefits_assignment             VARCHAR(10),
    benefits_assignment_desc        VARCHAR(100),
    release_of_info_code            VARCHAR(10),

    -- SBR / filing indicator
    claim_filing_indicator_code     VARCHAR(10),
    claim_filing_indicator_desc     VARCHAR(100),
    payer_responsibility_code       VARCHAR(5),
    payer_responsibility_desc       VARCHAR(50),

    -- CL1 segment (institutional only)
    admission_type_code             VARCHAR(10),
    admission_type_desc             VARCHAR(100),
    admission_source_code           VARCHAR(10),
    admission_source_desc           VARCHAR(100),
    patient_status_code             VARCHAR(10),
    patient_status_desc             VARCHAR(100),

    -- Prior authorization
    prior_auth_number               VARCHAR(50),
    prior_auth_status               VARCHAR(20) DEFAULT 'none'
                                    CHECK (prior_auth_status IN (
                                        'none', 'pending', 'approved', 'denied', 'not_required'
                                    )),

    -- Resubmission tracking
    original_claim_id               VARCHAR(50),
    resubmission_code               VARCHAR(10),
    is_clean_claim                  BOOLEAN,

    -- Payer info (from SBR/NM1 PR)
    payer_id                        VARCHAR(50),
    payer_name                      VARCHAR(255),

    -- Patient info
    patient_id                      VARCHAR(50),

    -- ML prediction fields (Phase 4 foundation)
    prediction_score                DECIMAL(5,4),
    prediction_factors              JSONB,

    -- Timestamps
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_headers_org ON claim_headers(org_id);
CREATE INDEX idx_claim_headers_claim_id ON claim_headers(claim_id);
CREATE INDEX idx_claim_headers_status ON claim_headers(claim_status);
CREATE INDEX idx_claim_headers_payer ON claim_headers(payer_id);
CREATE INDEX idx_claim_headers_file ON claim_headers(file_name);
CREATE INDEX idx_claim_headers_filing ON claim_headers(claim_filing_indicator_code);

-- =============================================================================
-- 3. CLAIM LINES — SV1 (837P) or SV2 (837I) service line items
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_lines (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER NOT NULL REFERENCES claim_headers(id) ON DELETE CASCADE,
    line_number             INTEGER NOT NULL,

    -- Procedure info
    procedure_code          VARCHAR(10),
    procedure_desc          VARCHAR(255),
    procedure_qualifier     VARCHAR(10),
    procedure_qualifier_desc VARCHAR(100),
    modifier_1              VARCHAR(10),
    modifier_2              VARCHAR(10),
    modifier_3              VARCHAR(10),
    modifier_4              VARCHAR(10),

    -- Revenue code (837I only)
    revenue_code            VARCHAR(10),
    revenue_code_desc       VARCHAR(100),

    -- Amounts
    charge_amount           DECIMAL(12,2),
    paid_amount             DECIMAL(12,2),
    allowed_amount          DECIMAL(12,2),

    -- Units
    unit_count              DECIMAL(10,2),
    unit_measurement_code   VARCHAR(10),
    unit_measurement_desc   VARCHAR(50),

    -- Place of service (837P)
    place_of_service_code   VARCHAR(10),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(claim_header_id, line_number)
);

CREATE INDEX idx_claim_lines_header ON claim_lines(claim_header_id);
CREATE INDEX idx_claim_lines_procedure ON claim_lines(procedure_code);
CREATE INDEX idx_claim_lines_revenue ON claim_lines(revenue_code);

-- =============================================================================
-- 4. CLAIM DIAGNOSES — HI segment data
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_diagnoses (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER NOT NULL REFERENCES claim_headers(id) ON DELETE CASCADE,
    diagnosis_code          VARCHAR(15) NOT NULL,
    diagnosis_type          VARCHAR(30) NOT NULL
                            CHECK (diagnosis_type IN (
                                'principal', 'admitting', 'other', 'reason_for_visit',
                                'external_cause', 'drg'
                            )),
    code_qualifier          VARCHAR(10),
    code_qualifier_desc     VARCHAR(100),
    sequence_number         INTEGER NOT NULL DEFAULT 1,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_dx_header ON claim_diagnoses(claim_header_id);
CREATE INDEX idx_claim_dx_code ON claim_diagnoses(diagnosis_code);

-- =============================================================================
-- 5. CLAIM DATES — DTP segments (header-level and line-level combined)
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_dates (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER NOT NULL REFERENCES claim_headers(id) ON DELETE CASCADE,
    claim_line_id           INTEGER REFERENCES claim_lines(id) ON DELETE CASCADE,
    date_qualifier          VARCHAR(10) NOT NULL,
    date_qualifier_desc     VARCHAR(100),
    date_format_qualifier   VARCHAR(10),
    date_value              VARCHAR(20) NOT NULL,
    parsed_date             DATE,
    parsed_date_end         DATE,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_dates_header ON claim_dates(claim_header_id);
CREATE INDEX idx_claim_dates_qualifier ON claim_dates(date_qualifier);
CREATE INDEX idx_claim_dates_parsed ON claim_dates(parsed_date);

-- =============================================================================
-- 6. CLAIM PROVIDERS — NM1/PRV segments per claim
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_providers (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER NOT NULL REFERENCES claim_headers(id) ON DELETE CASCADE,
    provider_role           VARCHAR(30) NOT NULL
                            CHECK (provider_role IN (
                                'billing', 'rendering', 'attending', 'referring',
                                'operating', 'supervising', 'service_location', 'other'
                            )),
    entity_identifier_code  VARCHAR(10),
    entity_type_qualifier   VARCHAR(5),
    npi                     VARCHAR(10),
    tax_id                  VARCHAR(15),
    id_code_qualifier       VARCHAR(10),
    last_or_org_name        VARCHAR(255),
    first_name              VARCHAR(100),
    middle_name             VARCHAR(50),
    taxonomy_code           VARCHAR(20),

    -- Address (from N3/N4 segments)
    address_line1           VARCHAR(255),
    address_city            VARCHAR(100),
    address_state           VARCHAR(2),
    address_zip             VARCHAR(10),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_providers_header ON claim_providers(claim_header_id);
CREATE INDEX idx_claim_providers_npi ON claim_providers(npi);
CREATE INDEX idx_claim_providers_role ON claim_providers(provider_role);

-- =============================================================================
-- 7. CLAIM REFERENCES — REF segments per claim
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_references (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER NOT NULL REFERENCES claim_headers(id) ON DELETE CASCADE,
    reference_qualifier     VARCHAR(10) NOT NULL,
    reference_qualifier_desc VARCHAR(100),
    reference_value         VARCHAR(100),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_refs_header ON claim_references(claim_header_id);
CREATE INDEX idx_claim_refs_qualifier ON claim_references(reference_qualifier);

-- =============================================================================
-- 8. CLAIM PAYMENTS — from 835 CLP segments
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_payments (
    id                      SERIAL PRIMARY KEY,
    claim_header_id         INTEGER REFERENCES claim_headers(id) ON DELETE SET NULL,
    org_id                  INTEGER REFERENCES organizations(id),
    file_name               VARCHAR(255),

    -- CLP segment fields
    patient_control_number  VARCHAR(50) NOT NULL,
    claim_status_code       VARCHAR(5),
    claim_status_desc       VARCHAR(100),
    total_charge_amount     DECIMAL(12,2),
    paid_amount             DECIMAL(12,2),
    patient_responsibility  DECIMAL(12,2),

    -- Payer info
    payer_id                VARCHAR(50),
    payer_name              VARCHAR(255),
    check_number            VARCHAR(50),
    payment_date            DATE,
    payment_method_code     VARCHAR(10),

    -- Tracking
    claim_filing_indicator_code VARCHAR(10),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_payments_header ON claim_payments(claim_header_id);
CREATE INDEX idx_claim_payments_pcn ON claim_payments(patient_control_number);
CREATE INDEX idx_claim_payments_payer ON claim_payments(payer_id);
CREATE INDEX idx_claim_payments_date ON claim_payments(payment_date);
CREATE INDEX idx_claim_payments_org ON claim_payments(org_id);

-- =============================================================================
-- 9. CLAIM PAYMENT LINES — from 835 SVC segments
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_payment_lines (
    id                      SERIAL PRIMARY KEY,
    claim_payment_id        INTEGER NOT NULL REFERENCES claim_payments(id) ON DELETE CASCADE,
    claim_line_id           INTEGER REFERENCES claim_lines(id) ON DELETE SET NULL,

    procedure_code          VARCHAR(10),
    modifier_1              VARCHAR(10),
    charge_amount           DECIMAL(12,2),
    paid_amount             DECIMAL(12,2),
    revenue_code            VARCHAR(10),
    units_paid              DECIMAL(10,2),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_lines_payment ON claim_payment_lines(claim_payment_id);

-- =============================================================================
-- 10. CLAIM ADJUSTMENTS — from 835 CAS segments (denial tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS claim_adjustments (
    id                          SERIAL PRIMARY KEY,
    claim_payment_id            INTEGER REFERENCES claim_payments(id) ON DELETE CASCADE,
    claim_payment_line_id       INTEGER REFERENCES claim_payment_lines(id) ON DELETE CASCADE,

    adjustment_group_code       VARCHAR(5) NOT NULL
                                CHECK (adjustment_group_code IN ('CO', 'PR', 'OA', 'PI', 'CR')),
    adjustment_group_desc       VARCHAR(100),
    carc_code                   VARCHAR(10) NOT NULL,
    carc_description            VARCHAR(500),
    adjustment_amount           DECIMAL(12,2),
    adjustment_quantity          INTEGER,

    rarc_code                   VARCHAR(10),
    rarc_description            VARCHAR(500),

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adjustments_payment ON claim_adjustments(claim_payment_id);
CREATE INDEX idx_adjustments_carc ON claim_adjustments(carc_code);
CREATE INDEX idx_adjustments_group ON claim_adjustments(adjustment_group_code);

-- =============================================================================
-- 11. PAYER DIRECTORY — reference table
-- =============================================================================
CREATE TABLE IF NOT EXISTS payer_directory (
    id              SERIAL PRIMARY KEY,
    payer_id        VARCHAR(50) NOT NULL UNIQUE,
    payer_name      VARCHAR(255) NOT NULL,
    payer_type      VARCHAR(30)
                    CHECK (payer_type IN (
                        'commercial', 'medicare_a', 'medicare_b', 'medicaid',
                        'bcbs', 'hmo', 'ppo', 'workers_comp', 'tricare',
                        'veterans', 'self_pay', 'other'
                    )),
    address_line1   VARCHAR(255),
    address_city    VARCHAR(100),
    address_state   VARCHAR(2),
    address_zip     VARCHAR(10),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 12. EDI FILE TRACKING — track processed files to prevent duplicates
-- =============================================================================
CREATE TABLE IF NOT EXISTS edi_file_log (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER REFERENCES organizations(id),
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(10) NOT NULL CHECK (file_type IN ('837P', '837I', '835')),
    file_hash       VARCHAR(64),
    record_count    INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'processed'
                    CHECK (status IN ('processing', 'processed', 'failed', 'duplicate')),
    error_message   TEXT,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(file_hash)
);

CREATE INDEX idx_edi_file_log_org ON edi_file_log(org_id);

-- =============================================================================
-- 13. ML PREDICTION HISTORY (Phase 4 foundation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prediction_history (
    id                  SERIAL PRIMARY KEY,
    claim_header_id     INTEGER REFERENCES claim_headers(id) ON DELETE CASCADE,
    prediction_score    DECIMAL(5,4) NOT NULL,
    prediction_factors  JSONB,
    model_version       VARCHAR(50),
    predicted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_claim ON prediction_history(claim_header_id);

-- =============================================================================
-- 14. USER PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id      INTEGER REFERENCES organizations(id),
    full_name   VARCHAR(255),
    role        VARCHAR(30) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(org_id);

-- =============================================================================
-- 15. MESSAGING SYSTEM (practice-to-payer disputes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_threads (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              INTEGER REFERENCES organizations(id),
    subject             TEXT NOT NULL,
    claim_id            VARCHAR(50),
    status_code         TEXT NOT NULL DEFAULT 'ACTIVE',
    status_desc         TEXT NOT NULL DEFAULT 'Active',
    thread_type_code    TEXT NOT NULL DEFAULT 'GEN',
    thread_type_desc    TEXT NOT NULL DEFAULT 'General',
    priority_code       TEXT DEFAULT 'NORM',
    priority_desc       TEXT DEFAULT 'Normal',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id           UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id           UUID REFERENCES auth.users(id),
    encrypted_content   TEXT,
    content_iv          TEXT,
    metadata            JSONB DEFAULT '{}',
    message_type_code   TEXT DEFAULT 'TEXT',
    message_type_desc   TEXT DEFAULT 'Text Message',
    parent_message_id   UUID REFERENCES messages(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id      UUID REFERENCES messages(id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    storage_path    TEXT NOT NULL,
    encrypted_key   TEXT,
    content_hash    TEXT,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_participants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id   UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id),
    role_code   TEXT NOT NULL DEFAULT 'PART',
    role_desc   TEXT NOT NULL DEFAULT 'Participant',
    permissions JSONB DEFAULT '{"can_read": true, "can_write": true}',
    added_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_proposals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id       UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    message_id      UUID REFERENCES messages(id),
    claim_id        VARCHAR(50),
    proposed_amount NUMERIC NOT NULL,
    status_code     TEXT NOT NULL DEFAULT 'PEND',
    status_desc     TEXT NOT NULL DEFAULT 'Pending',
    created_by      UUID REFERENCES auth.users(id),
    expiration_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_read_status (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id),
    read_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_thread_parts_thread ON thread_participants(thread_id);
CREATE INDEX idx_thread_parts_user ON thread_participants(user_id);
CREATE INDEX idx_settlements_thread ON settlement_proposals(thread_id);
CREATE INDEX idx_settlements_claim ON settlement_proposals(claim_id);
CREATE INDEX idx_msg_thread_claim ON message_threads(claim_id);

-- =============================================================================
-- 16. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE claim_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_payment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- Open read access for authenticated users (org-level filtering in app layer for now)
CREATE POLICY "Authenticated users can read claims" ON claim_headers
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert claims" ON claim_headers
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update claims" ON claim_headers
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read claim_lines" ON claim_lines
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_lines" ON claim_lines
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read claim_diagnoses" ON claim_diagnoses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_diagnoses" ON claim_diagnoses
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read claim_dates" ON claim_dates
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_dates" ON claim_dates
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read claim_providers" ON claim_providers
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_providers" ON claim_providers
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read claim_references" ON claim_references
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_references" ON claim_references
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read claim_payments" ON claim_payments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert claim_payments" ON claim_payments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read payment_lines" ON claim_payment_lines
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert payment_lines" ON claim_payment_lines
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read adjustments" ON claim_adjustments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert adjustments" ON claim_adjustments
    FOR INSERT TO authenticated WITH CHECK (true);

-- Messaging policies
CREATE POLICY "Users view their threads" ON message_threads
    FOR SELECT USING (id IN (
        SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users view thread messages" ON messages
    FOR SELECT USING (thread_id IN (
        SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users insert messages" ON messages
    FOR INSERT WITH CHECK (thread_id IN (
        SELECT thread_id FROM thread_participants
        WHERE user_id = auth.uid() AND permissions->>'can_write' = 'true'
    ));

CREATE POLICY "Users view attachments" ON message_attachments
    FOR SELECT USING (message_id IN (
        SELECT id FROM messages WHERE thread_id IN (
            SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users insert attachments" ON message_attachments
    FOR INSERT WITH CHECK (message_id IN (
        SELECT id FROM messages WHERE sender_id = auth.uid()
    ));

CREATE POLICY "Users manage participants" ON thread_participants
    FOR ALL USING (thread_id IN (
        SELECT thread_id FROM thread_participants
        WHERE user_id = auth.uid() AND permissions->>'can_write' = 'true'
    ));

CREATE POLICY "Users view settlements" ON settlement_proposals
    FOR SELECT USING (thread_id IN (
        SELECT thread_id FROM thread_participants WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users create settlements" ON settlement_proposals
    FOR INSERT WITH CHECK (thread_id IN (
        SELECT thread_id FROM thread_participants
        WHERE user_id = auth.uid() AND permissions->>'can_write' = 'true'
    ));

CREATE POLICY "Users manage read status" ON message_read_status
    FOR ALL USING (user_id = auth.uid());

-- Also allow anon read for development
CREATE POLICY "Anon read claims" ON claim_headers FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read lines" ON claim_lines FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read diagnoses" ON claim_diagnoses FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read dates" ON claim_dates FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read providers" ON claim_providers FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read refs" ON claim_references FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read payments" ON claim_payments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read payment_lines" ON claim_payment_lines FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read adjustments" ON claim_adjustments FOR SELECT TO anon USING (true);

-- Grant access
GRANT SELECT, INSERT, UPDATE ON claim_headers TO authenticated, anon;
GRANT SELECT, INSERT ON claim_lines TO authenticated, anon;
GRANT SELECT, INSERT ON claim_diagnoses TO authenticated, anon;
GRANT SELECT, INSERT ON claim_dates TO authenticated, anon;
GRANT SELECT, INSERT ON claim_providers TO authenticated, anon;
GRANT SELECT, INSERT ON claim_references TO authenticated, anon;
GRANT SELECT, INSERT ON claim_payments TO authenticated, anon;
GRANT SELECT, INSERT ON claim_payment_lines TO authenticated, anon;
GRANT SELECT, INSERT ON claim_adjustments TO authenticated, anon;
GRANT SELECT, INSERT ON payer_directory TO authenticated, anon;
GRANT SELECT, INSERT ON edi_file_log TO authenticated, anon;
GRANT SELECT ON organizations TO authenticated, anon;
GRANT SELECT ON prediction_history TO authenticated, anon;
GRANT ALL ON user_profiles TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
