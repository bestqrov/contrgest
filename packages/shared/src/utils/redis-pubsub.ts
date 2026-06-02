import Redis from 'ioredis';
import type { RedisChannel } from '../constants/channels';

let _publisher: Redis | null = null;

export function getPublisher(): Redis {
  if (_publisher) return _publisher;
  _publisher = new Redis(process.env.REDIS_URL!, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
  return _publisher;
}

export async function publish(
  channel: RedisChannel,
  payload: Record<string, unknown>,
): Promise<void> {
  await getPublisher().publish(channel, JSON.stringify(payload));
}

/** Create a dedicated subscriber connection (must not be reused for commands). */
export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
}

export async function subscribe(
  subscriber: Redis,
  channels: RedisChannel[],
  handler: (
    channel: RedisChannel,
    payload: Record<string, unknown>,
  ) => void,
): Promise<void> {
  await subscriber.subscribe(...channels);
  subscriber.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message) as Record<string, unknown>;
      handler(channel as RedisChannel, payload);
    } catch {
      // malformed message — skip silently
    }
  });
}
