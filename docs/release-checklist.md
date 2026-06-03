# Release Checklist

1. Bump version with one command, either from GitHub Actions or locally:
   - GitHub Actions: run `release-version`, enter the exact version number, for example `0.1.11`
   - patch: `npm run release:patch`
   - minor: `npm run release:minor`
   - major: `npm run release:major`
   - exact version: `npm run release -- 0.1.1`
   - This updates `package.json`, syncs `manifest.json`, creates a commit, creates tag `vX.Y.Z`, then pushes both `HEAD` and tag `vX.Y.Z` to `origin`.
   - The GitHub Actions workflow requires a `RELEASE_TOKEN` repository secret with repository Contents read/write access so the pushed tag triggers downstream workflows.
2. Run quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:fixtures`
   - `npm run build`
3. Smoke test in Chrome + Edge with unpacked `dist/`.
4. Verify the `store-packages` workflow succeeded for this tag. It creates the shared store artifacts:
   - `cleanedin-chrome-vX.Y.Z.zip`
   - `cleanedin-edge-vX.Y.Z.zip`
5. Verify `publish-chrome` and `publish-edge` workflows succeed. They now download the zip from `store-packages` artifacts instead of rebuilding.
   - `publish-edge` uses Microsoft Edge Add-ons API `v1` endpoints.
6. If you run publish workflows manually, pass `store_run_id` from the successful `store-packages` run.
7. Verify store listing legal URLs:
   - Privacy policy: `https://cleanedin.yasingedik.com/privacy-policy.html`
   - Terms of service: `https://cleanedin.yasingedik.com/terms-of-service.html`
8. Verify `deploy-firebase-hosting` workflow succeeded on `main` for website/legal page changes.
9. Verify landing page is live at `https://cleanedin.yasingedik.com/`.
10. Update changelog and release notes.
