-- 重置项目10的工序数据，用于测试
-- Reset processes for project 10 for testing
-- PostgreSQL Version

-- 将所有工序状态改为未开始
UPDATE process_executions 
SET 
    status = 'not_started',
    completion_percentage = 0,
    actual_start_date = NULL,
    actual_end_date = NULL,
    measurements = NULL,
    note = '重置用于测试 Reset for testing'
WHERE project_id = 10;

-- 清空材料使用记录
DELETE FROM materials WHERE project_id = 10;

-- 清空子任务
DELETE FROM subtasks WHERE process_execution_id IN (
    SELECT id FROM process_executions WHERE project_id = 10
);

-- 清空照片
DELETE FROM photos WHERE project_id = 10;

-- 清空活动日志
DELETE FROM activity_log WHERE project_id = 10;

-- 重置项目进度
UPDATE projects 
SET 
    progress = 0,
    status = 'not_started'
WHERE id = 10;

-- 显示结果
SELECT 'Project 10 has been reset successfully!' AS message;
SELECT COUNT(*) AS total_processes FROM process_executions WHERE project_id = 10;
