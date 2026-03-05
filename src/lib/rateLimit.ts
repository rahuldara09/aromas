import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Production-grade rate limiter using Upstash Redis.
 *
 * Works correctly across ALL Vercel serverless instances (shared Redis store).
 * Algorithm: Sliding-window — fair and accurate under burst traffic.
 *
 * Required env vars (add to Vercel Dashboard → Settings → Environment Variables):
 *   UPSTASH_REDIS_REST_URL   — from Upstash Console → REST API
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash Console → REST API
 *
 * Fallback: If Upstash env vars are not set (e.g. local dev without Redis),
 * all requests are allowed through so dev workflow is unaffected.
 */

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetAt: number;
}

// Lazily initialised so the module loads fine even without env vars
let _ratelimit: Ratelimit | null = null;

function getRatelimiter(maxRequests: number, windowSeconds: number): Ratelimit | null {
    // Re-use cached instance when possible
    if (_ratelimit) return _ratelimit;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        // Local dev without Upstash — bypass rate limiting gracefully
        return null;
    }

    _ratelimit = new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds}s`),
        analytics: false,
        prefix: 'aromas_rl',
    });

    return _ratelimit;
}

export async function rateLimit(
    key: string,
    maxRequests: number,
    windowMs: number
): Promise<RateLimitResult> {
    const limiter = getRatelimiter(maxRequests, Math.round(windowMs / 1000));

    // No Redis configured (local dev) → allow all requests
    if (!limiter) {
        const resetAt = Date.now() + windowMs;
        return { success: true, remaining: maxRequests - 1, resetAt };
    }

    const { success, remaining, reset } = await limiter.limit(key);
    return { success, remaining, resetAt: reset };
}

/** Get the real client IP from request headers */
export function getClientIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

/** Returns a 429 response with retry-after header */
export function tooManyRequests(resetAt: number): NextResponse {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(resetAt),
            },
        }
    );
}

