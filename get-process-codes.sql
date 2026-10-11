-- 获取项目10的所有工序代码
SELECT DISTINCT pn.process_code 
FROM process_nodes pn 
WHERE pn.project_id = 10 
ORDER BY pn.process_code;
