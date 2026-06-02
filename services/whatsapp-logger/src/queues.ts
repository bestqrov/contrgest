import { Queue, Worker, type Job } from 'bullmq';
import { QUEUES } from '@field-ops/shared';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    db: parseInt(url.pathname.replace('/', '') || '0', 10),
  };
}

export const waEventsQueue = new Queue(QUEUES.WA_EVENTS, { connection: redisConnection() });
export const waMediaQueue = new Queue(QUEUES.WA_MEDIA_DOWNLOAD, { connection: redisConnection() });

export function createEventsWorker(processor: (job: Job) => Promise<void>): Worker {
  return new Worker(QUEUES.WA_EVENTS, processor, {
    connection: redisConnection(),
    concurrency: 5,
  });
}

export function createMediaWorker(processor: (job: Job) => Promise<void>): Worker {
  return new Worker(QUEUES.WA_MEDIA_DOWNLOAD, processor, {
    connection: redisConnection(),
    concurrency: 3,
  });
}
