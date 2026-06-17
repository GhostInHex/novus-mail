import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

dotenv.config({ path: envPath });

const required = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GOOGLECALENDAR_CLIENT_ID',
  'GOOGLECALENDAR_CLIENT_SECRET',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error('Missing required env vars in .env.local:');
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  console.error('\nCopy .env.example to .env.local, fill in the values, then run `npm run corsair:setup:env`.');
  process.exit(1);
}

const args = [
  'corsair',
  'setup',
  '--',
  '--gmail',
  `client_id=${process.env.GMAIL_CLIENT_ID}`,
  `client_secret=${process.env.GMAIL_CLIENT_SECRET}`,
  '--googlecalendar',
  `client_id=${process.env.GOOGLECALENDAR_CLIENT_ID}`,
  `client_secret=${process.env.GOOGLECALENDAR_CLIENT_SECRET}`,
];

if (process.env.GMAIL_TOPIC_ID) {
  args.splice(6, 0, `topic_id=${process.env.GMAIL_TOPIC_ID}`);
}

console.log('Running corsair setup with env credentials...');
console.log(args.join(' '));

try {
  execFileSync('npx', args, { stdio: 'inherit' });
} catch (error) {
  console.error('\nCorsair setup failed.');
  process.exit(error.status ?? 1);
}
