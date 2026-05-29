# Publishing ax-ray to npm

Working checklist for the v0.1.0 launch.

## One-time prep

- [ ] Create a GitHub repo for `ax-ray` and decide the org / user. Default below is `<your-github-org>`.
- [ ] Replace `REPLACE_BEFORE_PUBLISH` with that org / user in:
      - `package.json` (`repository.url`, `bugs.url`, `homepage`)
      - `src/cli.ts` (two strings, in `renderDebug` and `renderCoverage`)
      - `README.md` (any github.com references — sweep with `grep -rn REPLACE_BEFORE_PUBLISH`).
- [ ] Add a GitHub `Actions` workflow that runs `npm test` on PRs (low priority for launch; can fast-follow).
- [ ] Create an npm account (or `npm login` with an existing one) with publish rights.
- [ ] (Optional, recommended) reserve the `ax-ray` name on npm by publishing v0.0.1-pre right after creating the account.

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
