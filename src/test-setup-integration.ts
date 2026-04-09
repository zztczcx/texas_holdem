/**
 * Setup for integration tests: loads the .env.local file so real service
 * credentials (Upstash Redis, Pusher) are available to the test process.
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
