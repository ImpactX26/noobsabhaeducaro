// Runs before every test file. Tests never use a real secret: a fresh random one per run.
import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
