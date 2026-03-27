const rateLimitMap = new Map<
  string,
  { count: number; lastReset: number }
>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap) {
    if (now - value.lastReset > 120_000) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.lastReset > windowMs) {
    rateLimitMap.set(key, { count: 1, lastReset: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

// Preset rate limiters
export function rateLimitLogin(ip: string) {
  return rateLimit(`login:${ip}`, 5, 60_000);
}

export function rateLimitSignup(ip: string) {
  return rateLimit(`signup:${ip}`, 3, 60_000);
}

export function rateLimitMessaging(userId: string) {
  return rateLimit(`msg:${userId}`, 30, 60_000);
}
