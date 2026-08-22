-- Storage adapter key + migration ledger (idempotent)
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='employee_documents' AND COLUMN_NAME='storage_key');
SET @sql := IF(@col=0, 'ALTER TABLE employee_documents ADD COLUMN storage_key VARCHAR(512) NULL AFTER storage_path', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
