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
7. Verify store listing legal URLs:
   - Privacy policy: `https://cleanedin.yasingedik.com/privacy-policy.html`
   - Terms of service: `https://cleanedin.yasingedik.com/terms-of-service.html`
8. Verify `deploy-firebase-hosting` workflow succeeded on `main` for website/legal page changes.
9. Verify landing page is live at `https://cleanedin.yasingedik.com/`.
10. Update changelog and release notes.
