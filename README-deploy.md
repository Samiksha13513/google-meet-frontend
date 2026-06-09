Deployment notes

This repository requires Node 20.x to build (Next 16). Use one of the options below.

Local build steps (Windows PowerShell):

1) Install nvm-windows (https://github.com/coreybutler/nvm-windows) or Node 20 from nodejs.org.

2) Use Node 20:

```powershell
nvm install 20.9.0
nvm use 20.9.0
node -v
```

3) Install dependencies and build:

```powershell
cd "D:\New folder\meeting\meet\google-meet-frontend"
npm ci
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build 2>&1 | Tee-Object build.log
```

CI / GitHub Actions

- The repo includes a GitHub Actions workflow `.github/workflows/build-and-deploy.yml` that runs on pushes to `dev`, sets up Node 20, runs the build and (optionally) deploys to Vercel using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets.

Vercel

- `package.json` engines set to `"node": "20.x"` and `vercel.json` present to force Node 20 runtime for serverless functions. In the Vercel Project settings confirm Node version is `20.x`.

If you hit a build error in CI or Vercel, copy the build log starting at `> google-meet-frontend@0.1.0 build` and paste it here; I will diagnose and patch the underlying code issue.
