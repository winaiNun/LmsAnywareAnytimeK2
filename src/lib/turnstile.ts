/**
 * Cloudflare Turnstile (bot check) - server side. Switched on by TURNSTILE_SECRET_KEY; without it every check passes,
 * so local development works with nothing set up. The browser side is components/turnstile.tsx (NEXT_PUBLIC_TURNSTILE_SITE_KEY).
 */
export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "local") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // can't reach Cloudflare: fail closed (the person can retry)
  }
}
