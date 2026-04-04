-- Extend user key metadata for password rewrap and recovery-based forgot-password flow.

ALTER TABLE USER_KEY_METADATA
  ADD (RECOVERY_WRAPPED_DEK_B64 CLOB);

ALTER TABLE USER_KEY_METADATA
  ADD (PASSWORD_EPOCH NUMBER(10, 0) DEFAULT 1 NOT NULL);
