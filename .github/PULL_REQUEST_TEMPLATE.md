<!--
Thank you for contributing to Relay.
Sanitize fixtures and logs — no secrets or private session bodies.
-->

## Summary

<!-- What does this PR change and why? Link issues: Fixes #123 -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature / provider / UX
- [ ] Breaking change (command, config, or tool contract)
- [ ] Documentation only
- [ ] Chore (CI, packaging, refactor with no behaviour change)
- [ ] Release / version bump

## How tested

```bash
# e.g.
npm test
npm run typecheck
# manual: pi -e ./dist/index.js → /relay …
```

- [ ] Unit tests added/updated when logic changed
- [ ] Manual TUI check for UI-facing changes (or N/A)

## Checklist

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Behaviour matches [SPEC.md](../SPEC.md) or SPEC is updated in this PR
- [ ] No new hand-rolled transcript parsers (Trajectory only)
- [ ] No new `if (provider === "…")` outside provider builtins (see `docs/provider-extensibility.md`) unless justified
- [ ] `CHANGELOG.md` `[Unreleased]` updated for user-visible changes
- [ ] Fixtures/logs sanitized
- [ ] README / config docs updated when user-facing

## Notes for reviewers

<!-- Risk areas, screenshots, follow-ups -->
