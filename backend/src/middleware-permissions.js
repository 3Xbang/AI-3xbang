// 权限检查中间件
const pool = require('./config/db');

// 角色权限矩阵 - 简化版，使用单一权限名称
const PERMISSIONS = {
    manager: [
        'view_all_projects',
        'create_project',
        'update_project',
        'delete_project',
        'manage_projects',  // 管理项目的通用权限（包括增删改查工序、依赖等）
        'purchase_material',
        'assign_task',
        'manage_users',
        'view_all_data'
    ],
    purchaser: [
        'view_assigned_projects',
        'create_project',
        'purchase_material',
        'assign_task',
        'update_progress'
    ],
    executor: [
        'view_assigned_projects',
        'update_progress'
    ]
};

// 检查用户是否有权限访问项目
async function checkProjectAccess(client, userId, userRole, projectId) {
    // 管理者可以访问所有项目
    if (userRole === 'manager') {
        return true;
    }
    
    // 其他角色检查是否是项目成员
    const result = await client.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
    );
    
    return result.rows.length > 0;
}

// 检查用户是否有权限
function hasPermission(userRole, permission) {
    const rolePermissions = PERMISSIONS[userRole];
    if (!rolePermissions) return false;
    
    return rolePermissions.includes(permission);
}

// 权限检查中间件工厂函数
function requirePermission(permission) {
    return (req, res, next) => {
        const userRole = req.user.role;
        
        if (!hasPermission(userRole, permission)) {
            return res.status(403).json({
                success: false,
                message: '权限不足 | ไม่มีสิทธิ์'
            });
        }
        
        next();
    };
}

// 项目访问权限检查中间件
function requireProjectAccess() {
    return async (req, res, next) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        const projectId = req.params.projectId || req.params.id || req.body.project_id;
        
        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: '缺少项目ID | ไม่มี ID โครงการ'
            });
        }
        
        const client = await pool.connect();
        try {
            const hasAccess = await checkProjectAccess(client, userId, userRole, projectId);
            
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: '无权访问此项目 | ไม่มีสิทธิ์เข้าถึงโครงการนี้'
                });
            }
            
            next();
        } finally {
            client.release();
        }
    };
}

// 记录操作日志
async function logActivity(client, userId, action, targetType, targetId, details) {
    try {
        await client.query(
            `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, targetType, targetId, details]
        );
    } catch (error) {
        console.error('Log activity error:', error);
    }
}

module.exports = {
    PERMISSIONS,
    hasPermission,
    checkProjectAccess,
    requirePermission,
    requireProjectAccess,
    logActivity
};
