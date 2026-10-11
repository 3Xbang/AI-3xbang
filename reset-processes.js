// Quick script to reset all Project 10 processes to not_started
const { Pool } = require('pg');

const pool = new Pool({
  host: '18.206.11.7',
  user: 'construction_user',
  password: 'Winaii2024Strong',
  database: 'construction_simple',
  port: 5432
});

async function resetProcesses() {
  try {
    const result = await pool.query(`
      UPDATE process_execution 
      SET status = 'not_started', 
          completion_percentage = 0, 
          actual_start_date = NULL, 
          actual_end_date = NULL
      WHERE process_node_id IN (
        SELECT id FROM process_nodes WHERE project_id = 10
      )
    `);
    
    console.log(`✓ Reset ${result.rowCount} processes`);
    
    // Verify
    const verify = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM process_execution 
      WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10)
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('\nStatus breakdown:');
    verify.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

resetProcesses();
