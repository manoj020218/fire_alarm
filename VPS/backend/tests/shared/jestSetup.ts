/**
 * Runs in each Jest worker before any test files are loaded.
 * Sets minimum required env vars so env.ts Zod validation passes.
 * MONGODB_URI is overridden later by globalSetup's process.env propagation.
 */

// Only set defaults if not already provided (globalSetup may have set them in the same process)
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-secret-that-is-at-least-32-characters-long!!';
process.env['JWT_EXPIRY'] = process.env['JWT_EXPIRY'] ?? '1h';
process.env['JWT_REFRESH_EXPIRY'] = process.env['JWT_REFRESH_EXPIRY'] ?? '7d';
process.env['PORT'] = process.env['PORT'] ?? '3099';
process.env['TELEMETRY_RETENTION_DAYS'] = process.env['TELEMETRY_RETENTION_DAYS'] ?? '90';
// MONGODB_URI: globalSetup sets this; if running solo provide a fallback
process.env['MONGODB_URI'] = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/fireguard_test_fallback';
// Billing bridge
process.env['BRIDGE_SECRET'] = process.env['BRIDGE_SECRET'] ?? 'test-bridge-secret-min16chars';
process.env['BILLING_BASE'] = process.env['BILLING_BASE'] ?? 'https://iotsoft.in';
process.env['APP_LOGIN_URL'] = process.env['APP_LOGIN_URL'] ?? 'https://fireguard.iotsoft.in/app';
