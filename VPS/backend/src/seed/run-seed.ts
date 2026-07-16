/**
 * Seed runner entry point.
 * Usage: pnpm seed
 */
import mongoose from 'mongoose';
import { seedAbcTowers } from './abcTowers.seed';

const uri = process.env['MONGODB_URI'];
if (!uri) {
  console.error('MONGODB_URI not set — cannot seed');
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(() => seedAbcTowers())
  .then(() => mongoose.disconnect())
  .catch((err: unknown) => {
    console.error('Seed failed', err);
    process.exit(1);
  });
