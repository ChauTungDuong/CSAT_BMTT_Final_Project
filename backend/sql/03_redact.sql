-- Kết nối: sqlplus system/<password>@//localhost/XEPDB1
-- DBMS_REDACT thêm lớp mask tại tầng DB (độc lập với app layer)

-- GRANT EXECUTE ON DBMS_REDACT TO SMASK_USER;

-- Ví dụ: áp dụng DBMS_REDACT cho cột EMAIL (plaintext)
BEGIN
    DBMS_REDACT.ADD_POLICY(
        object_schema       => 'SMASK_USER',
        object_name         => 'CUSTOMERS',
        column_name         => 'EMAIL',
        policy_name         => 'redact_email_teller',
        function_type       => DBMS_REDACT.PARTIAL,
        function_parameters => 'VVVFVVVVVVVVVVVVVVVVV,VV,*,3,7',
        expression          => '1=1'
    );
END;
/
