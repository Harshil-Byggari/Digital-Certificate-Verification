const oracledb = require('oracledb');
require('dotenv').config();

// Enable auto-commit for transactions unless explicitly handled
oracledb.autoCommit = true;
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initOraclePool() {
  try {
    pool = await oracledb.createPool({
      user: process.env.ORACLE_USER || 'certitrust_admin',
      password: process.env.ORACLE_PASSWORD || 'certitrust_pass',
      connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1',
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2
    });
    console.log('Connected to Oracle Database connection pool successfully.');
    return pool;
  } catch (err) {
    console.error('Failed to create Oracle connection pool:', err.message);
    throw err;
  }
}

async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    if (!pool) {
      await initOraclePool();
    }
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (err) {
    console.error('Oracle Query Execution Error:', err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error('Error closing Oracle connection:', closeErr.message);
      }
    }
  }
}

module.exports = {
  initOraclePool,
  executeQuery
};

