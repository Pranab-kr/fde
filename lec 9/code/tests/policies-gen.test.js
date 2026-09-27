import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const expectedFiles = [
  'return_refund_policy.pdf',
  'shipping_delivery_policy.pdf',
  'privacy_cookie_policy.pdf',
  'terms_of_service.pdf',
  'warranty_repairs_policy.pdf',
  'cancellation_policy.pdf',
];

const policiesDir = path.join(__dirname, '../policies');
assert.ok(fs.existsSync(policiesDir), 'policies directory should exist');

for (const file of expectedFiles) {
  const filePath = path.join(policiesDir, file);
  assert.ok(fs.existsSync(filePath), `File ${file} should exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1000, `File ${file} should be non-empty (was ${stat.size} bytes)`);
}

console.log('Task 2 policies generation test passed');
