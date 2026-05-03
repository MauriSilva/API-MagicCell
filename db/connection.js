const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'MagicCell@2026',
  database: 'magic_cell',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = db;