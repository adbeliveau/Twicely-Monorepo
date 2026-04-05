# G10.1 Load Testing + Security Audit -- Research Findings

## Key Discoveries

1. **No middleware.ts exists** -- No `apps/web/src/middleware.ts` or `apps/web/middleware.ts`. Route protection and rate limiting are NOT implemented via Next.js middleware. This is a significant gap for rate limit verification.

2. **Security headers already configured** -- `next.config.ts` has CSP, HSTS, X-Frame-Options, etc. but with deviations from canonical spec:
   - `unsafe-eval` in CSP (spec says no)
   - `X-DNS-Prefetch-Control: on` (spec says `off`)
   - `camera=(self)` (spec says `camera=()`)
   - Missing `payment=(self)` in Permissions-Policy

3. **No CI/CD exists** -- No `.github/` directory at all. This is the first CI pipeline.

4. **No SAST tooling** -- No `eslint-plugin-security`, no Semgrep, no Snyk in any package.json.

5. **Only rate limiter is crosslister-specific** -- `apps/web/src/lib/crosslister/queue/rate-limiter.ts` is a sliding-window limiter for the crosslister queue only. No general API rate limiting exists.

6. **Rate limit seeds exist** -- Platform settings in `v32-platform-settings-extended.ts` have rate limit values seeded, but no middleware consumes them.

7. **k6 chosen over Artillery** -- Grafana ecosystem alignment (project already uses Grafana + Prometheus + Loki for monitoring).

8. **Deployment target is Railway** -- CLAUDE.md Decision #62 overrides Build Brief (Coolify + Hetzner).

## Spec References
- Actors Security S5.5: Security headers table
- Actors Security S5.6: CSP policy
- Actors Security S6.2: Rate limits per actor type
- Actors Security S17.1: Automated security testing requirements
- Testing Standards S5: Performance targets (LCP < 2.5s, P95 < 500ms, P99 < 1000ms)
- Testing Standards S6: CI gates (typecheck, lint, test, build)
