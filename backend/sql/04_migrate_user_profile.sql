-- ================================================================
-- Migration: Add FULL_NAME and EMAIL columns to USERS table
-- Run this on existing databases that were created before this change
-- ================================================================

ALTER TABLE USERS ADD (
    FULL_NAME VARCHAR2(200),
    EMAIL     VARCHAR2(200)
);
