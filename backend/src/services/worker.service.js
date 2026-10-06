const pool = require('../config/db');

/**
 * 获取项目的工人列表
 */
exports.getWorkersByProject = async (projectId, userId, userRole, status = null) => {
  // 检查项目权限
  const projectService = require('./project.service');
  await projectService.getProjectById(projectId, userId, userRole);

  let query = `
    SELECT 
      w.*,
      COALESCE(
        (SELECT COUNT(*) FROM daily_attendance 
         WHERE worker_id = w.worker_id AND status = 'present'),
        0
      ) as attendance_days
    FROM workers w
    WHERE w.project_id = $1
  `;
  const params = [projectId];

  if (status) {
    query += ` AND w.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY w.join_date DESC, w.worker_id`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 添加工人
 */
exports.addWorker = async (workerData) => {
  const {
    project_id,
    name,
    role,
    id_number,
    phone,
    daily_wage,
    join_date
  } = workerData;

  const query = `
    INSERT INTO workers (
      project_id, name, role, id_number, phone, daily_wage, join_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
    RETURNING *
  `;

  const result = await pool.query(query, [
    project_id,
    name,
    role,
    id_number || null,
    phone || null,
    daily_wage || 0,
    join_date || new Date()
  ]);

  return result.rows[0];
};

/**
 * 更新工人信息
 */
exports.updateWorker = async (workerId, updateData) => {
  const allowedFields = [
    'name', 'role', 'id_number', 'phone', 'daily_wage', 'status', 'leave_date', 'notes'
  ];

  const updates = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(updateData[key]);
      paramIndex++;
    }
  });

  if (updates.length === 0) {
    throw new Error('没有可更新的字段');
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(workerId);

  const query = `
    UPDATE workers 
    SET ${updates.join(', ')}
    WHERE worker_id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw new Error('工人不存在');
  }

  return result.rows[0];
};

/**
 * 删除工人
 */
exports.deleteWorker = async (workerId) => {
  const query = 'DELETE FROM workers WHERE worker_id = $1';
  const result = await pool.query(query, [workerId]);

  if (result.rowCount === 0) {
    throw new Error('工人不存在');
  }
};

/**
 * 获取考勤记录
 */
exports.getAttendance = async (projectId, userId, userRole, startDate, endDate, workerId = null) => {
  // 检查项目权限
  const projectService = require('./project.service');
  await projectService.getProjectById(projectId, userId, userRole);

  let query = `
    SELECT 
      da.*,
      w.name as worker_name,
      w.role as worker_role,
      w.daily_wage,
      u.username as recorder_name
    FROM daily_attendance da
    LEFT JOIN workers w ON da.worker_id = w.worker_id
    LEFT JOIN users u ON da.created_by = u.user_id
    WHERE da.project_id = $1
  `;
  const params = [projectId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND da.attendance_date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND da.attendance_date <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (workerId) {
    query += ` AND da.worker_id = $${paramIndex}`;
    params.push(workerId);
    paramIndex++;
  }

  query += ` ORDER BY da.attendance_date DESC, w.name`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 记录考勤
 */
exports.recordAttendance = async (attendanceData) => {
  const {
    project_id,
    worker_id,
    attendance_date,
    status,
    work_hours,
    overtime_hours,
    notes,
    created_by
  } = attendanceData;

  // 获取工人日薪
  const workerQuery = 'SELECT daily_wage FROM workers WHERE worker_id = $1';
  const workerResult = await pool.query(workerQuery, [worker_id]);

  if (workerResult.rows.length === 0) {
    throw new Error('工人不存在');
  }

  const dailyWage = parseFloat(workerResult.rows[0].daily_wage);
  let dailyCost = 0;

  // 计算当日成本
  if (status === 'present') {
    dailyCost = dailyWage;
    if (overtime_hours > 0) {
      dailyCost += (dailyWage / 8) * overtime_hours * 1.5; // 加班1.5倍
    }
  } else if (status === 'half-day') {
    dailyCost = dailyWage * 0.5;
  } else if (status === 'overtime') {
    dailyCost = (dailyWage / 8) * (work_hours || 0) * 1.5;
  }

  const query = `
    INSERT INTO daily_attendance (
      project_id, worker_id, attendance_date, status, 
      work_hours, overtime_hours, daily_cost, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (worker_id, attendance_date) 
    DO UPDATE SET 
      status = EXCLUDED.status,
      work_hours = EXCLUDED.work_hours,
      overtime_hours = EXCLUDED.overtime_hours,
      daily_cost = EXCLUDED.daily_cost,
      notes = EXCLUDED.notes,
      created_by = EXCLUDED.created_by
    RETURNING *
  `;

  const result = await pool.query(query, [
    project_id,
    worker_id,
    attendance_date,
    status,
    work_hours || 8,
    overtime_hours || 0,
    dailyCost,
    notes || null,
    created_by
  ]);

  return result.rows[0];
};

/**
 * 批量记录考勤
 */
exports.batchRecordAttendance = async (projectId, date, attendanceList, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const records = [];

    for (const item of attendanceList) {
      const attendanceData = {
        project_id: projectId,
        worker_id: item.worker_id,
        attendance_date: date,
        status: item.status,
        work_hours: item.work_hours,
        overtime_hours: item.overtime_hours,
        notes: item.notes,
        created_by: userId
      };

      const record = await exports.recordAttendance(attendanceData);
      records.push(record);
    }

    await client.query('COMMIT');

    return records;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
