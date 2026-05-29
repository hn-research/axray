# Publishing ax-ray to npm

CI-driven publish with provenance attestation. Tag a version, push the tag, the workflow publishes.

## One-time setup

- [x] GitHub repo: `hn-research/axray`.
- [x] `ci.yml` runs on PRs and main (lint + test + build).
- [x] `publish.yml` runs on `v*` tag push (lint + test + build + `npm publish --provenance --access public`).
- [ ] **Create an npm account** (or `npm login`) with publish rights to a name not yet taken on the registry.
- [ ] **Create an Automation token** on npmjs.com:
  - `https://www.npmjs.com/settings/<your-username>/tokens` → **Generate New Token** → **Granular Access Token** (or "Automation" type)
  - Scope: read & write
  - Packages: `ax-ray` (after first publish you can scope tighter; for the first publish leave it unscoped or use account-wide)
  - Expiration: as long as you're comfortable (rotate later)
- [ ] **Add it to the repo as a secret**:
  - `https://github.com/hn-research/axray/settings/secrets/actions` → **New repository secret**
  - Name: `NPM_TOKEN`
  - Value: paste the token from the previous step

## Verifying the package name is still free

```sh
npm view ax-ray
# If you see "404 Not Found" — it's free. Proceed.
# If you see metadata — someone took it; rename in package.json.
```

## Publishing v0.1.0

```sh
cd /Users/ago/workspace/ax-ray
git tag v0.1.0
git push origin v0.1.0
```

That pushes the tag, which triggers `publish.yml`. Open the Actions tab to watch it run; ~2 minutes to green.

Once it's green, verify from a *fresh* shell (not the one you developed in):

```sh
npx ax-ray --demo
npx ax-ray --demo --connect --how-to-fix
```

If those run cleanly against the synthetic surface, you're live.

## What `--provenance` gives you

After publish, the package page on npm (`https://www.npmjs.com/package/ax-ray`) shows a **"Provenance"** badge linking back to:
- The exact git commit on `hn-research/axray` that built it
- The GitHub Actions workflow run that ran the build
- The integrity hash of the tarball

Anyone consuming the package can verify the published bytes match the source commit. This is the package-side equivalent of the trust posture ax-ray itself enforces on MCP servers.

## Releasing v0.1.1 (and later)

```sh
# bump version in package.json + CHANGELOG.md entry
npm version patch     # bumps to 0.1.1 and creates a v0.1.1 tag
git push --follow-tags
```

`--follow-tags` pushes the tag created by `npm version`. CI takes over.

## Migrating to npm Trusted Publishing (optional, later)

Once `ax-ray` is on npm, you can swap NPM_TOKEN for OIDC trust:

1. `https://www.npmjs.com/package/ax-ray/access` → **Trusted publishers** → Add publisher
2. Source: GitHub
3. Org/user: `hn-research`
4. Repo: `axray`
5. Workflow: `publish.yml`
6. Optional: pin a default-branch environment

After that, you can remove the `NPM_TOKEN` env from `publish.yml` and the `NPM_TOKEN` secret from the repo. Provenance still works (it's the OIDC path either way). Pure-OIDC publishing reduces the surface area of "what could leak."

## Troubleshooting

- **"You cannot publish over the previously published versions"** — bump the version in `package.json` before tagging.
- **"403 Forbidden"** — the token doesn't have publish rights on this package, or it's been scoped to a different package name. Regenerate broader.
- **"You do not have permission to publish 'ax-ray'"** — name is taken. Verify with `npm view ax-ray`.
- **Provenance attestation step fails** — `id-token: write` is missing from the workflow permissions, or Node is older than 22.5. The workflow above has both right.
