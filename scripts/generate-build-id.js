import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const randomHash = crypto.randomBytes(3).toString('hex');
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const buildId = `v${dateStr}-${randomHash}`;
const buildTime = now.toISOString();

const contentTs = `// Auto-generated at build time\nexport const BUILD_ID = '${buildId}';\nexport const BUILD_TIME = '${buildTime}';\n`;
const contentJs = `// Auto-generated at build time\nexport const BUILD_ID = '${buildId}';\nexport const BUILD_TIME = '${buildTime}';\n`;

fs.writeFileSync(path.resolve('src/buildInfo.ts'), contentTs, 'utf8');
fs.writeFileSync(path.resolve('api/_buildInfo.mjs'), contentJs, 'utf8');
console.log(`[build-id] Generated BUILD_ID: ${buildId} (${buildTime})`);
