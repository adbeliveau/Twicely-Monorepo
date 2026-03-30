import { Queue, Worker, type ConnectionOptions, type Processor, type QueueOptions } from 'bullmq';
import { registerShutdown } from './shutdown-registry';

/**
 * Valkey/Redis connection configuration.
 * Uses VALKEY_HOST and VALKEY_PORT environment variables.
 */
const connection: ConnectionOptions = {
  host: process.env.VALKEY_HOST ?? '127.0.0.1',
  port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
  maxRetriesPerRequest: null,
};

/**
 * Create a BullMQ queue with consistent connection config.
 */
export function createQueue<T>(
  name: string,
  opts?: Pick<QueueOptions, 'defaultJobOptions'>,
): Queue<T> {
  return new Queue<T>(name, { connection, ...opts });
}

/**
 * Create a BullMQ worker with consistent connection config.
 */
export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  concurrency = 5
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency,
  });
  registerShutdown(() => worker.close());
  return worker;
}

export { connection };
