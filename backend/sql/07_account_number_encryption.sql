-- ================================================================
-- Migration: Encrypt Account Numbers (Support for Encrypted Storage)
-- Adds ACCOUNT_NUMBER_HASH column for searchable lookups
-- Modifies ACCOUNT_NUMBER to store encrypted blob
-- ================================================================

-- Step 1: Add new column for hash-based lookups
ALTER TABLE ACCOUNTS ADD (ACCOUNT_NUMBER_HASH VARCHAR2(64));

-- Step 2: Create unique index on the new hash column
CREATE UNIQUE INDEX UQ_ACCOUNTS_NUMBER_HASH ON ACCOUNTS(ACCOUNT_NUMBER_HASH);

-- Step 3: Rename old account number column (keep backup)
ALTER TABLE ACCOUNTS RENAME COLUMN ACCOUNT_NUMBER TO ACCOUNT_NUMBER_LEGACY;

-- Step 4: Add new ACCOUNT_NUMBER column as BLOB for encrypted storage
ALTER TABLE ACCOUNTS ADD (ACCOUNT_NUMBER BLOB);

-- Step 4b: Drop legacy plaintext column (reset flow does not need it)
ALTER TABLE ACCOUNTS DROP COLUMN ACCOUNT_NUMBER_LEGACY;

-- Step 5: Drop old UNIQUE constraint if it exists on the renamed column
BEGIN
  FOR c IN (
    SELECT constraint_name FROM user_constraints 
    WHERE table_name = 'ACCOUNTS' AND constraint_type = 'U' 
     AND constraint_name LIKE '%ACCOUNT_NUMBER%'
   ) 
   LOOP
    EXECUTE IMMEDIATE 'ALTER TABLE ACCOUNTS DROP CONSTRAINT ' || c.constraint_name;
  END LOOP;
END;
/

-- Note: This migration is intended for reset flow where no legacy account data is preserved.

