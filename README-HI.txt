PLAYWIN FREE AUTO PUBLISH — PHONE SETUP

Files:
- index.html: Updated admin page with Future Results + edit feature + 2D prefix validation.
- auto-publish.js: Generates future draws and publishes due draws.
- .github/workflows/auto-publish.yml: Runs every 5 minutes and supports manual run.
- package.json: Firebase Admin SDK dependency.

2D rule:
30 four-digit values. First two digits must be 10–19, 30–39, 50–59 exactly once each. Last two digits are random 00–99.
3D: A/B/C random 000–999.
Titli Goda: random choice from the 12 options already in index.html.

GITHUB PHONE SETUP:
1. Open https://github.com/rajsrilotto-max/Playwin in Chrome and use Desktop site if needed.
2. Upload/replace root index.html with this package's index.html.
3. Add auto-publish.js and package.json in repository root.
4. Create path .github/workflows/auto-publish.yml and paste the supplied workflow file.
5. In Firebase Console > Project settings > Service accounts, generate a private key for a service account with Firebase Admin access. Keep this JSON private.
6. In GitHub repo Settings > Secrets and variables > Actions > New repository secret, create:
   Name: FIREBASE_SERVICE_ACCOUNT_JSON
   Value: the entire downloaded service-account JSON file contents.
7. Open Actions tab > PlayWin Auto Publish > Run workflow. Check logs.

IMPORTANT FREE-PLAN LIMIT:
The workflow is scheduled every 5 minutes because Titli draws are every 5 minutes. GitHub-hosted runner minutes are subject to the repository visibility and account quota. On a private repository, 5-minute scheduled runs can exceed the monthly included minutes. Do not enable paid billing. Check Settings > Billing and plans > Usage before relying on continuous operation. Public repositories generally have free standard runner usage, but making a repository public exposes all source code (never put secrets in files; GitHub Secrets remain masked/private). Do not change repository visibility without deciding this yourself.

FIREBASE DATABASE RULES:
The Admin SDK workflow bypasses Realtime Database client rules. The browser admin panel's Future Results page needs authenticated admin permission to read /playwinV2/futureDraws and update only scheduled future entries. It also writes /playwinV2/auditLog. Merge these permissions into your EXISTING rules; do not replace all rules blindly. Existing public user panel access requirements must be preserved. Published /history and /current should not be writable from the browser.

LIMITATIONS / TESTING:
- GitHub scheduled workflows can start late and are not guaranteed exact-to-the-second. A 5-minute schedule may publish after the scheduled time if GitHub queues the run late.
- The workflow creates future records when it first runs and publishes them once due.
- Admin edits are allowed only while status is scheduled and drawAt is still in the future; published records are locked in the UI.
- Before live use, run a manual workflow and verify a test future draw in Firebase and Admin > Future Results.
- Do not share the service-account JSON or private key in chat, screenshots, or repository files.
