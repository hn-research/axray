# Publishing ax-ray to npm

Working checklist for the v0.1.0 launch.

## One-time prep

- [x] GitHub repo: `hn-research/axray` (under the `OpenProjects` team).
- [x] CI workflow at `.github/workflows/ci.yml` (lint + test + build on PRs).
- [ ] Create an npm account (or `npm login`) with publish rights to `ax-ray`.
- [ ] (Recommended) configure npm Trusted Publishing so the future `publish.yml`
      workflow can `npm publish --provenance --access public` without a token.
      Settings: npmjs.com → the `ax-ray` package → "Publishing access" →
      Trusted publishers → add `hn-research/axray` with workflow `publish.yml`.

## Pre-publish verification

```sh
npm run lint
npm test
npm run build
npm pack --dry-run
```

`npm pack --dry-run` prints the file list of what would be uploaded. Check that:

- `dist/` is included (compiled output).
- `README.md` and `LICENSE` are included.
- `node_modules/`, `tests/`, `src/`, the `cassette.tape`, and CHANGELOG.md are EXCLUDED (the `files` field in package.json controls this; only `dist`, `README.md`, `LICENSE` ship).

## Recording the launch GIF

```sh
brew install vhs
vhs cassette.tape
# produces launch.gif at the repo root
```

Optionally also record a static-mode GIF (`ax-ray --demo`) for the README; the connect+how-to-fix version is the headline one.

## Publish

```sh
# Test publish to a private dist-tag first
npm publish --dry-run

# Real publish
npm publish --access public

# Verify the world can install it
npx ax-ray --demo
```

After the first publish, future releases:

```sh
# Bump version in package.json (and CHANGELOG.md)
npm version patch       # or minor / major
git push --tags
npm publish
```

## Post-publish

- [ ] Update `README.md` to drop the "v0.1, in active construction" status line.
- [ ] Tweet / post the launch GIF + the npm link.
- [ ] Drop the link into the IETF draft's Implementation Status section.
