-- ================================================================
-- Migration: Add FULL_NAME and EMAIL columns to USERS table
-- Safe to rerun.
-- ================================================================

DECLARE
    v_full_name NUMBER;
    v_email NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_full_name
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = 'FULL_NAME';

    IF v_full_name = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (FULL_NAME VARCHAR2(200))';
    END IF;

    SELECT COUNT(*) INTO v_email
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = 'EMAIL';

    IF v_email = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (EMAIL BLOB)';
    END IF;
END;
/

COMMIT;
