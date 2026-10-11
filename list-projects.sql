-- 列出所有项目
SELECT id, name->>'zh' as name_zh, name->>'th' as name_th, created_at FROM projects ORDER BY id;
