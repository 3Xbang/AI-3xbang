-- 修复admin密码
DELETE FROM users WHERE username='admin';
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$.iORE4XTXc3mNVadMGITYORv/LTzx9t56i6UyFumcGjsv89OEH4Xe', 'admin');
SELECT username, role, LEFT(password_hash, 20) as hash_prefix FROM users WHERE username='admin';
