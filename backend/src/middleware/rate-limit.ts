// Rate limiting middleware for abuse control. Uses Redis for distributed state
// (survives process restarts) and falls back to in-memory when Redis is
// unavailable. Limits are per-IP with additional per-invoice gates on verify.
//
// Design: Token bucket with refill. Each limit is a (capacity, refill_rate,
// window) tuple. Rejections return 429 with Retry-After in seconds.
import { Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import { createRedisClient } from '../config/redis';

interface RateLimitRule {
  /** Max tokens in the bucket */
  capacity: number;
  /** How many tokens refill per window */
  refillAmount: number;
  /** Window in seconds */
  windowSeconds: number;
  /** Human-readable label for logging */
  label: string;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export type RateLimitKey = 
  | 'create_invoice'
  | 'verify_payment'
  | 'list_invoices'
  | 'cancel_invoice'
  | 'get_stats';

const RATE_LIMITS: Record<RateLimitKey, RateLimitRule> = {
  create_invoice: {
    capacity: 10,
    refillAmount: 10,
    windowSeconds: 600, // 10 minutes
    label: 'Invoice creation',
  },
  verify_payment: {
    capacity: 30,
    refillAmount: 30,
    windowSeconds: 60,
    label: 'Payment verification',
  },
  list_invoices: {
    capacity: 60,
    refillAmount: 60,
    windowSeconds: 60,
    label: 'Invoice listing',
  },
  cancel_invoice: {
    capacity: 10,
    refillAmount: 10,
    windowSeconds: 60,
    label: 'Invoice cancellation',
  },
  get_stats: {
    capacity: 60,
    refillAmount: 60,
    windowSeconds: 60,
    label: 'Stats retrieval',
  },
};

/**
 * Per-invoice verification limit: prevents one invoice from exhausting Horizon
 * quota through repeated verify calls. This is a secondary limit on top of the
 * per-IP verify limit.
 */
const VERIFY_PER_INVOICE_LIMIT: RateLimitRule = {
  capacity: 10,
  refillAmount: 10,
  windowSeconds: 60,
  label: 'Per-invoice verification',
};

/**
 * In-memory fallback when Redis is unavailable. Not shared across processes
 * but better than no limit at all.
 */
class MemoryRateLimitStore {
  private readonly buckets = new Map<string, TokenBucket>();

  async consume(key: string, rule: RateLimitRule): Promise<{ allowed: boolean; retryAfter: number }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: rule.capacity - 1, lastRefill: now };
      this.buckets.set(key, bucket);
      return { allowed: true, retryAfter: 0 };
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refillIntervals = Math.floor(elapsed / rule.windowSeconds);
    
    if (refillIntervals > 0) {
      bucket.tokens = Math.min(
        rule.capacity,
        bucket.tokens + refillIntervals * rule.refillAmount
      );
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfter: 0 };
    }

    // Calculate retry after based on when the next refill window completes
    const nextRefill = bucket.lastRefill + rule.windowSeconds * 1000;
    const retryAfter = Math.ceil((nextRefill - now) / 1000);
    
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  async checkOnly(key: string, rule: RateLimitRule): Promise<{ allowed: boolean }> {
    const bucket = this.buckets.get(key);
    if (!bucket) return { allowed: true };

    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refillIntervals = Math.floor(elapsed / rule.windowSeconds);
    
    const currentTokens = Math.min(
      rule.capacity,
      bucket.tokens + refillIntervals * rule.refillAmount
    );

    return { allowed: currentTokens > 0 };
  }

  // Cleanup old entries periodically
  cleanup(maxAgeMs: number = 3600000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefill < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Redis-backed rate limiter using Lua script for atomic token bucket operations.
 */
class RedisRateLimitStore {
  private redis: Redis | null = null;
  private connectionAttempted = false;

  async getClient(): Promise<Redis | null> {
    if (!this.connectionAttempted) {
      this.connectionAttempted = true;
      try {
        this.redis = await createRedisClient();
      } catch (error) {
        console.warn('[RateLimit] Redis unavailable, using memory fallback');
        this.redis = null;
      }
    }
    return this.redis;
  }

  async consume(key: string, rule: RateLimitRule): Promise<{ allowed: boolean; retryAfter: number }> {
    const client = await this.getClient();
    if (!client) {
      throw new Error('Redis not available');
    }

    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowMs = rule.windowSeconds * 1000;

    // Lua script for atomic token bucket consume
    const script = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_amount = tonumber(ARGV[2])
      local window_ms = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      local elapsed = now - last_refill
      local refill_intervals = math.floor(elapsed / window_ms)
      
      if refill_intervals > 0 then
        tokens = math.min(capacity, tokens + refill_intervals * refill_amount)
        last_refill = now
      end
      
      if tokens > 0 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        redis.call('EXPIRE', key, math.ceil(window_ms / 1000) * 2)
        return {1, 0}
      else
        local next_refill = last_refill + window_ms
        local retry_after = math.ceil((next_refill - now) / 1000)
        return {0, math.max(1, retry_after)}
      end
    `;

    try {
      const result = await client.eval(
        script,
        1,
        redisKey,
        rule.capacity.toString(),
        rule.refillAmount.toString(),
        windowMs.toString(),
        now.toString()
      ) as [number, number];

      return {
        allowed: result[0] === 1,
        retryAfter: result[1],
      };
    } catch (error) {
      console.error('[RateLimit] Redis error:', error);
      throw error;
    }
  }

  async checkOnly(key: string, rule: RateLimitRule): Promise<{ allowed: boolean }> {
    const client = await this.getClient();
    if (!client) {
      throw new Error('Redis not available');
    }

    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowMs = rule.windowSeconds * 1000;

    const bucket = await client.hmget(redisKey, 'tokens', 'last_refill');
    const tokens = bucket[0] ? parseInt(bucket[0], 10) : rule.capacity;
    const lastRefill = bucket[1] ? parseInt(bucket[1], 10) : now;

    const elapsed = now - lastRefill;
    const refillIntervals = Math.floor(elapsed / windowMs);
    const currentTokens = Math.min(
      rule.capacity,
      tokens + refillIntervals * rule.refillAmount
    );

    return { allowed: currentTokens > 0 };
  }
}

const memoryStore = new MemoryRateLimitStore();
const redisStore = new RedisRateLimitStore();

// Cleanup memory store every hour
setInterval(() => memoryStore.cleanup(), 3600000);

/**
 * Get client IP from request, considering X-Forwarded-For (Vercel, Render)
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limit middleware factory
 */
export function rateLimitMiddleware(limitKey: RateLimitKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rule = RATE_LIMITS[limitKey];
    const ip = getClientIp(req);
    const key = `${limitKey}:${ip}`;

    try {
      // Try Redis first, fall back to memory
      let result;
      try {
        result = await redisStore.consume(key, rule);
      } catch (redisError) {
        result = await memoryStore.consume(key, rule);
      }

      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter.toString());
        res.status(429).json({
          success: false,
          error: `${rule.label} rate limit exceeded`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Unexpected error:', error);
      // Fail open: don't block requests if rate limiting breaks
      next();
    }
  };
}

/**
 * Per-invoice verification rate limit (secondary check beyond per-IP limit)
 */
export async function checkInvoiceVerifyLimit(invoiceId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `verify_invoice:${invoiceId}`;
  const rule = VERIFY_PER_INVOICE_LIMIT;

  try {
    try {
      return await redisStore.consume(key, rule);
    } catch (redisError) {
      return await memoryStore.consume(key, rule);
    }
  } catch (error) {
    console.error('[RateLimit] Invoice verification limit check failed:', error);
    return { allowed: true }; // Fail open
  }
}

/**
 * Check if a request would be rate limited without consuming a token
 * (useful for preflights or conditional logic)
 */
export async function checkRateLimit(limitKey: RateLimitKey, ip: string): Promise<{ allowed: boolean }> {
  const rule = RATE_LIMITS[limitKey];
  const key = `${limitKey}:${ip}`;

  try {
    try {
      return await redisStore.checkOnly(key, rule);
    } catch (redisError) {
      return await memoryStore.checkOnly(key, rule);
    }
  } catch (error) {
    console.error('[RateLimit] Check failed:', error);
    return { allowed: true };
  }
}

export default rateLimitMiddleware;
