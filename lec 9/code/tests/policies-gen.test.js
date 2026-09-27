const fs = require('fs');
const path = require('path');
const assert = require('assert');

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
