/**
 * Where the floating buttons (back to top, FAQ chat) must not appear: the back office, sign-in/up screens,
 * and pages with their own sticky bottom bar (lesson player, course editor).
 */
const HIDDEN_PREFIXES = ["/admin", "/login", "/register", "/offline"];
const HIDDEN_PATTERNS = [/^\/courses\/[^/]+\/learn(\/|$)/, /^\/dashboard\/courses\/[^/]+\/edit(\/|$)/, /^\/certificates\/[^/]+$/];

export function floatingHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || HIDDEN_PATTERNS.some((r) => r.test(pathname));
}
