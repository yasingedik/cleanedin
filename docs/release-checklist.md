# Release Checklist

1. Bump version with one command:
   - patch: `npm run release:patch`
   - minor: `npm run release:minor`
   - major: `npm run release:major`
   - exact version: `npm run release -- 0.1.1`
   - This updates `package.json`, syncs `manifest.json`, creates a commit, and creates tag `vX.Y.Z`.
2. Run quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:fixtures`
   - `npm run build`
3. Smoke test in Chrome + Edge with unpacked `dist/`.
4. Push release commit + tag:
   - `git push origin main --follow-tags`
5. Download store packages from the `store-packages` workflow artifact:
   - `cleanedin-chrome-vX.Y.Z.zip`
   - `cleanedin-edge-vX.Y.Z.zip`
6. Upload each zip to the relevant extension store submission form.
7. Verify privacy policy URL in both store listings points to `docs/privacy-policy.html` (hosted via GitHub Pages).
8. Update changelog and release notes.
