import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REFERENCE_FILE = path.join(__dirname, '../docs/Financial Data stockanalysis.com.txt');
const DB_DUMP_FILE = path.join(__dirname, '../debug_latest.sql');

const COMPANY_MAP = {
    'Nvidia': 'NVDA',
    'Apple': 'AAPL',
    'Microsoft': 'MSFT',
    'Amazon': 'AMZN',
    'Alphabet': 'GOOGL',
    'Meta': 'META',
    'Tesla': 'TSLA',
    'Broadcom': 'AVGO',
    'Berkshire': 'BRK.B'
};

function parseReferenceData(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const data = {};
    let currentCompany = null;
    let currentQuarters = [];
    let currentSection = null;

    for (let line of lines) {
        line = line.replace(/[\u200B-\u200D\uFEFF\f]/g, '').trim();
        if (!line) continue;

        for (const [name, ticker] of Object.entries(COMPANY_MAP)) {
            if (line.toLowerCase().includes(name.toLowerCase())) {
                currentCompany = ticker;
                if (!data[currentCompany]) data[currentCompany] = {};
                break;
            }
        }

        if (line.includes('Cash Flow Statement')) currentSection = 'CashFlow';
        if (line.includes('Income Statement')) currentSection = 'Income';

        if (line.startsWith('Fiscal Quarter') || line.startsWith('Fiscal Year')) {
            currentQuarters = line.match(/Q\d \d{4}/g) || [];
            continue;
        }

        if (currentSection === 'CashFlow' && line.startsWith('Free Cash Flow')) {
            if (line.includes('Per Share') || line.includes('Growth') || line.includes('Margin')) continue;

            const valuesStr = line.substring('Free Cash Flow'.length).trim();
            const matches = valuesStr.match(/-?[\d,]+(\.\d+)?/g);

            if (matches && currentQuarters.length > 0) {
                matches.forEach((val, index) => {
                    if (index < currentQuarters.length) {
                        const q = currentQuarters[index];
                        if (!data[currentCompany][q]) data[currentCompany][q] = {};
                        data[currentCompany][q].free_cash_flow = parseFloat(val.replace(/,/g, ''));
                    }
                });
            }
        }
    }
    return data;
}

function parseDbDump(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const dbData = {};
    const insertRegex = /INSERT INTO company_quarterly VALUES\s*\n?\(([^)]+)\)/g;

    let match;
    while ((match = insertRegex.exec(content)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        const ticker = values[0];
        const form = values[4];
        const fy = parseInt(values[5]);
        const fp = values[6];
        const fcf = values[18] === 'NULL' ? null : parseFloat(values[18]);

        if (form === '10-Q') {
            if (!dbData[ticker]) dbData[ticker] = {};
            dbData[ticker][`${fp} ${fy}`] = { free_cash_flow: fcf };
        }
    }
    return dbData;
}

const refData = parseReferenceData(REFERENCE_FILE);
const dbData = parseDbDump(DB_DUMP_FILE);

console.log('Comparing data...\n');

const discrepancies = [];
const TOLERANCE = 1000000;

for (const [ticker, quarters] of Object.entries(refData)) {
    if (!dbData[ticker]) continue;

    for (const [quarter, metrics] of Object.entries(quarters)) {
        if (!metrics.free_cash_flow) continue;

        const refFcf = metrics.free_cash_flow * 1000000;
        const dbEntry = dbData[ticker][quarter];

        if (dbEntry) {
            const dbFcf = dbEntry.free_cash_flow;
            if (dbFcf === null || Math.abs(refFcf - dbFcf) > TOLERANCE) {
                discrepancies.push({
                    type: 'MISMATCH',
                    ticker,
                    quarter,
                    refFcf,
                    dbFcf
                });
            }
        } else {
            discrepancies.push({
                type: 'MISSING',
                ticker,
                quarter,
                refFcf,
                dbFcf: null
            });
        }
    }
}

console.log(`Found ${discrepancies.length} discrepancies\n`);
console.log('First 10:');
discrepancies.slice(0, 10).forEach(d => {
    console.log(`  ${d.type}: ${d.ticker} ${d.quarter} - Ref: $${(d.refFcf / 1e9).toFixed(2)}B, DB: ${d.dbFcf ? '$' + (d.dbFcf / 1e9).toFixed(2) + 'B' : 'NULL'}`);
});

let sql = '';
discrepancies.forEach(d => {
    const [fp, fy] = d.quarter.split(' ');
    if (d.type === 'MISMATCH') {
        sql += `UPDATE company_quarterly SET free_cash_flow = ${d.refFcf} WHERE ticker = '${d.ticker}' AND fp = '${fp}' AND fy = ${fy};\n`;
    } else {
        sql += `-- MISSING ROW: ${d.ticker} ${d.quarter} (FCF: ${d.refFcf})\n`;
    }
});

const patchDir = path.join(__dirname, '../patches');
if (!fs.existsSync(patchDir)) fs.mkdirSync(patchDir, { recursive: true });

fs.writeFileSync(path.join(patchDir, 'fix_financial_data.sql'), sql);
console.log('\nPatch file created: patches/fix_financial_data.sql');
