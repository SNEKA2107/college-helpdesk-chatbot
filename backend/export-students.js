/**
 * Exports all students from MongoDB Atlas into SQL-style table formats:
 *   ../students-export.csv  — open in Excel / Google Sheets as a table
 *   ../students-export.sql  — CREATE TABLE + INSERT statements
 *
 * Usage: node export-students.js
 */
require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');
const User     = require('./models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas — database:', mongoose.connection.name);

  const total    = await User.countDocuments();
  const students = await User.find({ role: 'student' }).sort({ studentId: 1 }).lean();
  const byDept   = {};
  students.forEach(s => { byDept[s.department] = (byDept[s.department] || 0) + 1; });
  console.log(`Total users: ${total} | students: ${students.length}`);
  console.log('By department:', JSON.stringify(byDept));

  // ── CSV ──
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csvHeader = 'student_id,name,email,department,semester,phone,is_active,created_at';
  const csvRows = students.map(s => [
    s.studentId, s.name, s.email, s.department, s.semester, s.phone || '',
    s.isActive !== false, s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '',
  ].map(esc).join(','));
  const csvPath = path.join(__dirname, '..', 'students-export.csv');
  fs.writeFileSync(csvPath, '﻿' + [csvHeader, ...csvRows].join('\r\n'));
  console.log(`✅ CSV written: ${csvPath} (${csvRows.length} rows)`);

  // ── SQL ──
  const sqlEsc = v => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
  const sqlLines = [
    '-- CampusAssist students exported from MongoDB Atlas',
    `-- Generated ${new Date().toISOString()}`,
    'CREATE TABLE students (',
    '  student_id VARCHAR(20) PRIMARY KEY,',
    '  name       VARCHAR(100) NOT NULL,',
    '  email      VARCHAR(120),',
    '  department VARCHAR(40),',
    '  semester   VARCHAR(10),',
    '  phone      VARCHAR(15),',
    '  is_active  BOOLEAN DEFAULT TRUE',
    ');',
    '',
    ...students.map(s =>
      `INSERT INTO students (student_id, name, email, department, semester, phone, is_active) VALUES (` +
      [s.studentId, s.name, s.email, s.department, s.semester, s.phone || null]
        .map(sqlEsc).join(', ') +
      `, ${s.isActive !== false ? 'TRUE' : 'FALSE'});`),
  ];
  const sqlPath = path.join(__dirname, '..', 'students-export.sql');
  fs.writeFileSync(sqlPath, sqlLines.join('\n'));
  console.log(`✅ SQL written: ${sqlPath}`);
  process.exit(0);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
