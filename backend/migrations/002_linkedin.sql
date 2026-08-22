-- LinkedIn account connections (idempotent — safe to re-run)
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  linkedin_member_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NULL,
  first_name VARCHAR(128) NULL,
  last_name VARCHAR(128) NULL,
  picture_url VARCHAR(1024) NULL,
  email VARCHAR(255) NULL,
  scopes VARCHAR(255) NOT NULL,
  access_token_enc TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_linkedin_user (user_id),
  UNIQUE KEY uq_linkedin_member (linkedin_member_id),
  KEY idx_linkedin_company (company_id),
  CONSTRAINT fk_linkedin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_linkedin_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
