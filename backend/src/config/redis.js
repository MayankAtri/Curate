import Redis from 'ioredis';

let redisClient = null;

export function createRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });

  redisClient.on('connect', () => {
    console.log('Redis connected');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redisClient.on('close', () => {
    console.warn('Redis connection closed');
  });

  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
}

// Redis connection config for BullMQ (needs separate instances)
export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
};

// Cache helper functions
export async function getCache(key) {
  const client = getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache(key, value, ttlSeconds = 3600) {
  const client = getRedisClient();
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function deleteCache(key) {
  const client = getRedisClient();
  await client.del(key);
}

export async function deleteCachePattern(pattern) {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis connection closed');
  }
}
