# Contributing

## Develop

```bash
npm ci
npm test
pi -e ./dist/index.js   # after build
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | Extension source |
| `test/` | Node test runner unit tests |
| `SPEC.md` | Product spec (behavior source of truth) |
| `CHANGELOG.md` | User-facing release notes |
| `docs/publishing.md` | Tags, npm bootstrap, OIDC |
| `docs/provider-extensibility.md` | How to add Trajectory sources cleanly |

## Pull requests

- Keep changes focused; match existing TypeScript style (`exactOptionalPropertyTypes`).
- Add/adjust unit tests for match, title, handoff, config, search.
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- Do not commit `dist/` or `node_modules/`.

## Releases

Maintainers: follow [docs/publishing.md](./docs/publishing.md).  
**Do not** publish from a laptop for routine cuts — use the **Release** workflow and git tags.
