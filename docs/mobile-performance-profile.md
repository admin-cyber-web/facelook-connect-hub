# Authenticated mobile performance profile

`npm run perf:mobile` runs the same mobile navigation script against an
authenticated Playwright storage state. It measures:

- Supabase request count, request classes, response bytes, and failed requests
- Realtime WebSocket opens/closes, Phoenix channel joins/leaves, active topics,
  and frame activity
- Chromium main-thread task/script time as a CPU proxy
- Maximum mounted and actively playing media elements/videos
- An idle interval before the navigation script and per-flow deltas

The browser uses iPhone 13 emulation. This is useful for repeatable browser
measurements, but it is not a physical battery or thermal measurement. Browser
APIs do not expose a universal hardware decoder count, so the report records
actively playing media elements as the cross-browser decoder proxy.

## Run before and after a change

The profiler requires a Playwright `storageState` JSON containing a valid
authenticated Supabase session. It intentionally refuses to run without one
and never accepts or creates credentials:

```bash
PERF_STORAGE_STATE=/path/to/auth-state.json \
PERF_LABEL=before \
PERF_IDLE_MS=300000 \
npm run perf:mobile
```

The first run also needs the Playwright Chromium binary:

```bash
npx playwright install chromium
```

Run the exact same command with `PERF_LABEL=after` after the performance
changes. The JSON files are written under `reports/mobile-performance/`.
Compare only runs that report `authenticated: true` and that completed all
stages; an error exit is an incomplete profile, not a zero-traffic result.

For a quick smoke run, use a short idle interval and a short per-stage wait:

```bash
PERF_STORAGE_STATE=/path/to/auth-state.json \
PERF_LABEL=smoke \
PERF_IDLE_MS=5000 \
PERF_FLOW_MS=1000 \
npm run perf:mobile
```

Compare the `totals` object and each matching stage in the two JSON files.
The profiler fails if login is visible or if a required flow control is
missing; it does not turn guest-gated or incomplete runs into successful
authenticated results.

## Current environment limitation

On September 3, 2026 the available preview had no session (`INITIAL_SESSION
user=none`) and no authenticated storage-state file was present. Therefore no
authenticated before/after numbers are recorded in this workspace. The
profiler is ready to run once an authorized test session is supplied.

The current product navigation also has no `Snapy` entry even though
`Index.tsx` renders `SnapyStudio` for that feature value. The profiler reports
this as a required-flow failure rather than pretending the camera flow ran.
That navigation gap must be resolved, or the camera stage must be opened by an
explicit test-only route, before the full script can produce a complete
authenticated profile.