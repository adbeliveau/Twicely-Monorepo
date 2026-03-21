/**
 * Integration test: Valkey + BullMQ
 * Requires: Valkey running on localhost:6379
 *
 * Tests queue creation, job publishing, and job processing
 * against the real Valkey instance.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';

const connection = {
  host: process.env.VALKEY_HOST ?? '127.0.0.1',
  port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
  maxRetriesPerRequest: null,
};

const TEST_QUEUE = 'integration-test-queue';

describe('Valkey + BullMQ Integration', () => {
  const queue = new Queue(TEST_QUEUE, { connection });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('connects to Valkey and adds a job', async () => {
    const job = await queue.add('test-job', { hello: 'world' });
    expect(job.id).toBeDefined();
    expect(job.name).toBe('test-job');
  });

  it('processes a job from the queue', async () => {
    // Use a unique queue so stale jobs from prior runs don't interfere
    const workerQueue = new Queue('integration-worker-test', { connection });
    await workerQueue.obliterate({ force: true });

    const worker = new Worker<{ msg: string }>(
      'integration-worker-test',
      async (job: Job<{ msg: string }>) => job.data.msg,
      { connection },
    );

    try {
      const completed = new Promise<string>((resolve) => {
        worker.on('completed', (_job: Job<{ msg: string }>, result: string) => {
          resolve(result);
        });
      });

      await workerQueue.add('echo-job', { msg: 'integration-pass' });
      const result = await completed;
      expect(result).toBe('integration-pass');
    } finally {
      await worker.close();
      await workerQueue.obliterate({ force: true });
      await workerQueue.close();
    }
  });

  it('supports repeatable jobs', async () => {
    await queue.upsertJobScheduler('test-repeat', {
      every: 60_000,
    }, { name: 'repeat-test', data: { tick: true } });
    const schedulers = await queue.getJobSchedulers();
    expect(schedulers.length).toBeGreaterThanOrEqual(1);
    await queue.removeJobScheduler('test-repeat');
  });
});
