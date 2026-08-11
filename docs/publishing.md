# Publishing & versioning

## Model

> **The git tag is the version.**  
> CI stamps `package.json` from the tag at publish time for tagged releases.

| Artifact | Version source |
| --- | --- |
| npm `@hypabolic/relay` | Tag `vX.Y.Z` → `X.Y.Z` (or local `package.json` for bootstrap) |
| GitHub Release | Same tag |
| `CHANGELOG.md` | Human-written section for `X.Y.Z` **before** tagging |

| Event | Workflow | Action |
| --- | --- | --- |
| Push / PR to `main` | **CI** | test + pack dry-run |
| Tag `vX.Y.Z` | **Release** | Stamp → test → **npm OIDC publish** → GitHub Release |
| Manual dispatch | **Release** | Optional `npm_auth=token` / `dry_run` |

---

## Bootstrap (first publish) — **from this machine**

**Each version is published once.** Laptop *or* CI — never both for the same `X.Y.Z`.  
If you publish from the laptop, you can still push `vX.Y.Z` for the GitHub Release; the Release workflow **skips npm** when that version already exists.

OIDC trusted publishers can only be configured **after** the package exists under `@hypabolic`. Create it with a local publish.

### 1. npm login

Use an account that can publish the `@hypabolic` scope:

```bash
cd /home/matthew/development/hypabolic/Relay

npm login --auth-type=web --registry https://registry.npmjs.org
npm whoami
```

### 2. Publish 0.1.0

```bash
npm test
npm publish --access public
npm view @hypabolic/relay version    # → 0.1.0
```

One-shot helper (login if needed, then publish):

```bash
./scripts/bootstrap-npm-publish.sh
```

### 3. Trusted Publisher (later CI tags)

On the new package page → **Settings → Trusted Publisher**:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization | `Hypabolic` |
| Repository | `Relay` |
| Workflow filename | `release.yml` |
| Environment | `release` |

```bash
gh api -X PUT repos/Hypabolic/Relay/environments/release
```

### 4. Later releases (OIDC)

```bash
# CHANGELOG [Unreleased] → [X.Y.Z], commit on main
git tag -a vX.Y.Z -m "Relay X.Y.Z"
git push origin main
git push origin vX.Y.Z
```

---

## Normal release checklist

- [ ] `npm test` green  
- [ ] `CHANGELOG.md` dated `## [X.Y.Z]`  
- [ ] Commit on `main`  
- [ ] `git tag -a vX.Y.Z -m "Relay X.Y.Z"`  
- [ ] `git push origin main && git push origin vX.Y.Z`  
- [ ] `npm view @hypabolic/relay version`  

### Dry run (CI)

```bash
gh workflow run Release -R Hypabolic/Relay \
  -f tag=v0.1.0 -f dry_run=true -f npm_auth=token
```

---

## Local pack only

```bash
npm ci && npm test && npm pack
# → hypabolic-relay-0.1.0.tgz
```
