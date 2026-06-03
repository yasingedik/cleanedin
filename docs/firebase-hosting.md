# Firebase Hosting for CleanedIn Pages

This repository includes a static site for CleanedIn legal and product pages under:

- `/` (landing)
- `/privacy-policy.html`
- `/terms-of-service.html`

The intended production domain is:

- `https://cleanedin.yasingedik.com/`

Site files are in `docs/cleanedin/`, and `firebase.json` deploys that folder as the Hosting public root.

## Local deploy (manual)

### 1) Install and authenticate

```bash
npm i -g firebase-tools
firebase login
```

### 2) Select project

```bash
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`.
Use a dedicated Firebase project for this subdomain deployment.

### 3) Deploy

```bash
firebase deploy --only hosting
```

## GitHub to Firebase deploy (recommended)

Workflow: `.github/workflows/deploy-firebase-hosting.yml`

Trigger:
- `push` to `main` when `docs/cleanedin/**` or `firebase.json` changes
- manual `workflow_dispatch`

The workflow runs on Node 24 LTS and deploys with `firebase-tools@15.19.0`.

Required GitHub repository secrets:
- `FIREBASE_PROJECT_ID`: your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT`: JSON content of a service account key with Firebase Hosting deploy access

Service account setup:
1. Firebase Console -> Project Settings -> Service accounts
2. Create/generate a private key for a deploy service account
3. Add the full JSON as `FIREBASE_SERVICE_ACCOUNT` in GitHub secrets

## Verify routes

- `/`
- `/privacy-policy.html`
- `/terms-of-service.html`
- `/privacy` (redirect)
- `/terms` (redirect)
- `/cleanedin` (legacy redirect)
- `/cleanedin/privacy-policy.html` (legacy redirect)
- `/cleanedin/terms-of-service.html` (legacy redirect)
