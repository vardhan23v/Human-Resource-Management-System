-- Onboarding + branding (idempotent)
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='employees' AND COLUMN_NAME='onboarding_completed_at');
SET @s1 := IF(@c1=0, 'ALTER TABLE employees ADD COLUMN onboarding_completed_at DATETIME NULL', 'SELECT 1');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;
SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='employees' AND COLUMN_NAME='policy_accepted_at');
SET @s2 := IF(@c2=0, 'ALTER TABLE employees ADD COLUMN policy_accepted_at DATETIME NULL', 'SELECT 1');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;
