# PLAYWIN — free-first entertainment demo

Customer page and authenticated admin dashboard for entertainment-only random results.

## Free-first hosting plan
- **GitHub repository:** source code and scheduled GitHub Actions workflow.
- **Firebase Spark:** Realtime Database and Authentication within Spark plan quotas.
- **Netlify Free:** static website hosting (deploy the `public` folder).
- **GitHub Actions:** scheduled publisher every 5 minutes. Public repositories can use standard GitHub-hosted runners without a paid GitHub plan, subject to GitHub's current usage and fair-use rules.

## Firebase setup
1. Create a Firebase project and enable Realtime Database and Email/Password Authentication.
2. Copy the Firebase web app configuration into `public/firebase-config.js`.
3. Deploy `database.rules.json` as your Realtime Database rules.
4. Create an admin user in Firebase Authentication.
5. Assign that user the custom claim `{ "admin": true }` using a trusted Admin SDK environment. Never put a service-account key in frontend code.
6. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `FIREBASE_SERVICE_ACCOUNT`: the complete JSON contents of a Firebase service-account key.
   - `FIREBASE_DATABASE_URL`: your Realtime Database URL.
7. Commit the `.github/workflows/publish-results.yml` and `scripts/publish.js` files. Enable Actions in the repository.
8. Deploy `public/` to Netlify. Add your Firebase config before deploying.

## Scheduler behavior
GitHub Actions checks every 5 minutes. 2D and 3D results are generated at 15-minute boundaries; Titli Ghoda is generated at 5-minute boundaries. The workflow runs independently of the admin browser. The Auto Publish switch is stored in Firebase and can pause scheduled publication. GitHub scheduled workflows can be delayed and may be disabled by GitHub for inactive repositories; monitor the Actions tab.

## Free-plan limits and caveats
This setup avoids Firebase Cloud Functions and its billing-enabled Blaze requirement. Firebase Spark has quotas and feature limits; stay within the current free quotas. Netlify and GitHub may also change free-plan limits. No paid plan or billing upgrade should be enabled without the owner's explicit approval.

## Fair-play scope
Results are randomly generated for entertainment only. No wallet, deposits, withdrawals, cash prizes, betting, or payouts. Admin overrides apply only to the next scheduled draw. Published results are marked locked and should not be edited.
