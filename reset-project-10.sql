-- 重置项目10的所有数据，用于测试
-- Reset all data for project 10 for testing
-- PostgreSQL Version - Correct Table Names

BEGIN;

-- 1. 重置工序执行状态
UPDATE process_execution 
SET 
    status = 'not_started',
    completion_percentage = 0,
    actual_start_date = NULL,
    actual_end_date = NULL,
    measurements = NULL
WHERE project_id = 10;

-- 2. 清空子任务
DELETE FROM process_subtasks 
WHERE process_execution_id IN (
    SELECT id FROM process_execution WHERE project_id = 10
);

-- 3. 清空材料使用记录
DELETE FROM material_usage WHERE project_id = 10;

-- 4. 清空项目材料
DELETE FROM project_materials WHERE project_id = 10;

-- 5. 清空材料记录
DELETE FROM materials WHERE project_id = 10;

-- 6. 清空照片
DELETE FROM photos WHERE project_id = 10;

-- 7. 清空活动日志
DELETE FROM activity_logs WHERE project_id = 10;

-- 8. 清空每日进度
DELETE FROM daily_progress WHERE project_id = 10;

-- 9. 清空每日考勤
DELETE FROM daily_attendance WHERE project_id = 10;

-- 10. 重置项目状态
UPDATE projects 
SET 
    status = 'not_started'
WHERE id = 10;

COMMIT;

-- 显示重置结果
SELECT '✅ Project 10 has been reset successfully!' AS message;
SELECT 
    '📋 Total processes: ' || COUNT(*)::text AS info
FROM process_execution 
WHERE project_id = 10;
