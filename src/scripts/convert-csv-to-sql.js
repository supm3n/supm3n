// src/scripts/convert-csv-to-sql.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to the CSV in the root directory
const CSV_PATH = path.join(__dirname, '../../company_quarterly_big9_resolved_v2.csv');
const OUTPUT_PATH = path.join(__dirname, '../../src/seed_financials.sql');

console.log(`Reading from ${CSV_PATH}...`);

try {
    const data = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = data.trim().split('\n');
    const rows = lines.slice(1); // Skip header

    let sql = `DROP TABLE IF EXISTS company_quarterly;
CREATE TABLE company_quarterly (
  ticker TEXT,
  company_name TEXT,
  cik INTEGER,
  adsh TEXT PRIMARY KEY,
  form TEXT,
  fy INTEGER,
  fp TEXT,
  period_end TEXT,
  filed_at TEXT,
  revenue REAL,
  operating_income REAL,
  net_income REAL,
  diluted_eps REAL,
  operating_cash_flow REAL,
  capex REAL,
  net_margin REAL,
  operating_margin REAL,
  free_cash_flow REAL
);
`;

    const BATCH_SIZE = 50;
    let currentBatch = [];

    rows.forEach((rawRow) => {
        // FIX: .trim() removes the \r carriage return causing the syntax error
        const row = rawRow.trim();
        if (!row) return;

        // Split by comma, ignoring commas inside quotes
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        // Clean quotes and handle empty fields
        const cleaned = cols.map(c => {
            let val = c ? c.replace(/^"|"$/g, '') : '';
            if (val === '') return 'NULL';
            // If it's a number, return as-is; otherwise wrap in quotes
            return isNaN(val) ? `'${val}'` : val;
        });

        // Ensure we have exactly 18 columns before adding
        if (cleaned.length === 18) {
            currentBatch.push(`(${cleaned.join(',')})`);
        }

        // Write batch if full
        if (currentBatch.length >= BATCH_SIZE) {
            sql += `INSERT INTO company_quarterly VALUES \n${currentBatch.join(',\n')};\n`;
            currentBatch = [];
        }
    });

    // Write remaining rows
    if (currentBatch.length > 0) {
        sql += `INSERT INTO company_quarterly VALUES \n${currentBatch.join(',\n')};\n`;
    }

    fs.writeFileSync(OUTPUT_PATH, sql);
    console.log(`Done! Generated SQL at ${OUTPUT_PATH}`);

} catch (err) {
    console.error("Error processing file:", err.message);
}