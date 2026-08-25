const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let isConnected = false;
let redisClient = null;

try {
  redisClient = new Redis(REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
      // Exponential backoff with a cap of 10s
      return Math.min(times * 1000, 10000);
    },
  });

  redisClient.on('connect', () => {
    isConnected = true;
    console.log('[Redis] Connected to Redis server.');
  });

  redisClient.on('ready', () => {
    isConnected = true;
    console.log('[Redis] Client ready to process cache commands.');
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    // Suppress noisy ECONNREFUSED in local dev if Redis is not running
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      // Log once quietly
    } else {
      console.warn('[Redis] Connection warning:', err.message);
    }
  });

  redisClient.on('close', () => {
    isConnected = false;
  });

  redisClient.on('reconnecting', () => {
    isConnected = false;
  });

  // Attempt initial non-blocking connection
  redisClient.connect().catch(() => {
    isConnected = false;
    console.log('[Redis] Redis server offline or unreachable. Falling back automatically to Database layer.');
  });

} catch (err) {
  isConnected = false;
  console.warn('[Redis] Initialization error, running in database-only mode:', err.message);
}

/**
 * Check if Redis is currently connected and healthy.
 * @returns {boolean}
 */
function isAvailable() {
  return Boolean(isConnected && redisClient && redisClient.status === 'ready');
}

/**
 * Safe GET wrapper with automatic fallback.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  if (!isAvailable()) return null;
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
}

/**
 * Safe SET wrapper with TTL.
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds=3600]
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttlSeconds = 3600) {
  if (!isAvailable()) return false;
  try {
    if (ttlSeconds > 0) {
      await redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe DEL wrapper.
 * @param {string|string[]} keys
 * @returns {Promise<boolean>}
 */
async function del(keys) {
  if (!isAvailable()) return false;
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    if (keyArray.length > 0) {
      await redisClient.del(...keyArray);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe ZADD wrapper for sorted sets.
 * @param {string} key
 * @param {number} score
 * @param {string} member
 * @returns {Promise<boolean>}
 */
async function zadd(key, score, member) {
  if (!isAvailable()) return false;
  try {
    await redisClient.zadd(key, score, member);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe ZREVRANGE wrapper.
 * @param {string} key
 * @param {number} start
 * @param {number} stop
 * @param {boolean} [withScores=false]
 * @returns {Promise<Array>}
 */
async function zrevrange(key, start, stop, withScores = false) {
  if (!isAvailable()) return [];
  try {
    if (withScores) {
      return await redisClient.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return await redisClient.zrevrange(key, start, stop);
  } catch {
    return [];
  }
}

/**
 * Safe ZREVRANK wrapper (0-indexed rank descending).
 * @param {string} key
 * @param {string} member
 * @returns {Promise<number|null>}
 */
async function zrevrank(key, member) {
  if (!isAvailable()) return null;
  try {
    const rank = await redisClient.zrevrank(key, member);
    return rank !== null && rank !== undefined ? rank : null;
  } catch {
    return null;
  }
}

/**
 * Safe ZSCORE wrapper.
 * @param {string} key
 * @param {string} member
 * @returns {Promise<number|null>}
 */
async function zscore(key, member) {
  if (!isAvailable()) return null;
  try {
    const score = await redisClient.zscore(key, member);
    return score !== null ? parseFloat(score) : null;
  } catch {
    return null;
  }
}

/**
 * Disconnect cleanly.
 */
async function disconnect() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
  }
}

module.exports = {
  client: redisClient,
  isAvailable,
  get,
  set,
  del,
  zadd,
  zrevrange,
  zrevrank,
  zscore,
  disconnect,
};
