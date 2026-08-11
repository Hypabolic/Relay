# Publishing & versioning

## Model

Same idea as Hypa / Trajectory:

> **The git tag is the version.**  
> CI stamps `package.json` from the tag at publish time.  
> You do not hand-edit the version on the release commit unless you want main to match.

| Artifact | Version source |
| --- | --- |
| npm `@hypabolic/relay` | Tag `vX.Y.Z` → `X.Y.Z` |
| GitHub Release | Same tag |
| `CHANGELOG.md` | Human-written section for `X.Y.Z` **before** tagging |

### What runs when

| Event | Workflow | Action |
| --- | --- | --- |
| Push / PR to `main` | **CI** | `npm ci`, `npm test`, `npm pack --dry-run` |
| Tag `vX.Y.Z` | **Release** | Stamp version → test → **npm publish (OIDC)** → GitHub Release |
| Actions → Release → Run workflow | **Release** | Same, with optional `npm_auth=token` / `dry_run` |

---

## Bootstrap (first npm publish)

npm **Trusted Publisher (OIDC)** can only be configured after `@hypabolic/relay` exists on the registry.

### 1. npm automation token

Create an **automation** token on npmjs.com with permission to publish under `@hypabolic`.

### 2. GitHub secret + environment

```bash
# Repo secret (or org secret available to this repo)
gh secret set NPM_TOKEN -R Hypabolic/Relay

# Release environment used by the workflow (create if missing)
gh api -X PUT repos/Hypabolic/Relay/environments/release
```

### 3. Tag is already on the repo (example 0.1.0)

If `v0.1.0` is pushed but OIDC is not configured yet, **do not rely on the tag-push job**. Dispatch with token:

```bash
gh workflow run Release -R Hypabolic/Relay \
  -f tag=v0.1.0 \
  -f npm_auth=token \
  -f dry_run=false

gh run watch -R Hypabolic/Relay
```

### 4. Attach Trusted Publisher

On [npmjs.com/package/@hypabolic/relay](https://www.npmjs.com/package/@hypabolic/relay) → **Settings → Trusted Publisher**:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization | `Hypabolic` |
| Repository | `Relay` |
| Workflow filename | `release.yml` |
| Environment | `release` |

### 5. Later releases (OIDC)

```bash
# 1. Update CHANGELOG.md [Unreleased] → [X.Y.Z] + date
# 2. Optionally set "version" in package.json on main for local pack clarity
# 3. Commit on main
git tag -a vX.Y.Z -m "Relay X.Y.Z"
git push origin main
git push origin vX.Y.Z
```

Tag push uses **OIDC** (no `NPM_TOKEN` required once trusted publisher is set).

---

## Normal release checklist

- [ ] `npm test` green locally  
- [ ] `CHANGELOG.md` has a dated `## [X.Y.Z]` section  
- [ ] README install/version badges still accurate  
- [ ] Commit on `main`  
- [ ] `git tag -a vX.Y.Z -m "Relay X.Y.Z"`  
- [ ] `git push origin main && git push origin vX.Y.Z`  
- [ ] Confirm npm: `npm view @hypabolic/relay version`  
- [ ] Confirm GitHub Release assets  

### Dry run

```bash
gh workflow run Release -R Hypabolic/Relay \
  -f tag=v0.1.0 \
  -f dry_run=true \
  -f npm_auth=token
```

Packs and tests only; no publish / no GitHub Release.

---

## Version policy (practical)

| Bump | When |
| --- | --- |
| **patch** `0.1.x` | Fixes, copy, small UX, dependency patches |
| **minor** `0.x.0` | New provider, new command surface, compatible config keys |
| **major** `x.0.0` | Breaking config/command/tool renames |

`0.y.z` may still move quickly; document breaks in the changelog.

---

## Local pack (no publish)

```bash
npm ci
npm test
npm pack
# → hypabolic-relay-0.1.0.tgz
```

`prepack` runs `npm run build` so `dist/` is always fresh inside the tarball.

---

## Troubleshooting publish

| Error | Likely cause |
| --- | --- |
| `401` / `ENEEDAUTH` | Token missing/expired, or OIDC not configured |
| `You cannot publish over existing version` | Tag/version already on npm — bump |
| Environment `release` protection failed | Create environment or adjust protection rules |
| Provenance failed | Need npm ≥ 9.5+ / GitHub OIDC `id-token: write` (workflow already sets this) |
