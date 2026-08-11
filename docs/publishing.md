# Publishing @hypabolic/relay

## Bootstrap (first publish)

npm **Trusted Publishing (OIDC)** can only be attached after the package exists under the `@hypabolic` org. First cut uses a classic **automation** `NPM_TOKEN`.

1. Create an npm automation token with publish rights to `@hypabolic`.
2. Add it as a GitHub Actions secret on this repo (or the Hypabolic org):

   ```bash
   gh secret set NPM_TOKEN -R Hypabolic/Relay
   # paste token
   ```

3. Push `main` and tag:

   ```bash
   git push origin main
   git tag -a v0.1.0 -m "Relay 0.1.0"
   git push origin v0.1.0
   ```

   Tag pushes default to **OIDC** (will fail until trusted publisher exists). For bootstrap, run:

   ```bash
   gh workflow run Release -R Hypabolic/Relay \
     -f tag=v0.1.0 \
     -f npm_auth=token \
     -f dry_run=false
   ```

4. On [npmjs.com/package/@hypabolic/relay](https://www.npmjs.com/package/@hypabolic/relay) → **Settings → Trusted Publisher**:
   - GitHub
   - Repository: `Hypabolic/Relay`
   - Workflow: `release.yml`
   - Environment: `release` (if required)

5. Later tags can use OIDC (`npm_auth=oidc` or plain `git push origin vX.Y.Z`).

## Normal releases

```bash
# bump version in package.json + CHANGELOG, commit
git tag -a v0.1.1 -m "Relay 0.1.1"
git push origin v0.1.1
```

Release workflow stamps version from the tag, tests, publishes with provenance, creates a GitHub Release.

## Dry run

```bash
gh workflow run Release -R Hypabolic/Relay \
  -f tag=v0.1.0 \
  -f dry_run=true \
  -f npm_auth=token
```
