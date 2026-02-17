# Release Checklist

1. Verify version values:
   - `manifest.json`
   - `package.json`
2. Run quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:fixtures`
   - `npm run build`
3. Smoke test in Chrome + Edge with unpacked `dist/`.
4. Create a git tag `vX.Y.Z` and push it.
5. Download store packages from the `store-packages` workflow artifact:
   - `cleanedin-chrome-vX.Y.Z.zip`
   - `cleanedin-edge-vX.Y.Z.zip`
6. Upload each zip to the relevant extension store submission form.
7. Verify privacy policy URL in both store listings points to `docs/privacy-policy.html` (hosted via GitHub Pages).
8. Update changelog and release notes.
