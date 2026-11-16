# Fazal IT Content Studio

A private dashboard and five-stage LinkedIn draft workflow. The Vercel app uses Node.js functions, Neon Postgres, and OpenAI web search, text, and image APIs. Each stage gets its own input and writes a validated handoff. The first three model workers and independent QA use separate model calls, while the final worker builds the review packet in code.

## Run locally

1. Use Node.js 22. Run `npm install`.
2. Create a Neon database and run `db/schema.sql` in its SQL editor. Set the environment variables from `.env.example`.
3. Generate a random owner token of at least 24 characters, store it in your password manager, and set `OWNER_TOKEN` on the server. Use a different random token for `CRON_SECRET` if enabling the schedule.
4. Run `node --env-file=.env.local scripts/dev.mjs` if using an env file. Sign in at http://127.0.0.1:3000, create a test run and run its stages.

## Deploy on Vercel

Import the GitHub repository into a Vercel team eligible for business use and set the **Root Directory** to **content-studio**. Select **Other** and Node.js 22. The source config serves the dashboard from public/ and the API from api/. Add the database URL, API key and owner token as server-side environment variables before production deploy. Set preview values using a separate database and access token, or omit them to keep preview execution disabled. Run the schema first. After the first deployment open the dashboard, sign in, run one test, inspect each handoff and verify the packet.

Set BRAND_LOGO_URL to an owner-approved PNG on an HTTPS asset host, BRAND_LOGO_SHA256 to the SHA-256 of those exact bytes, and BRAND_COLOR to the approved hex color. The worker recomputes the logo hash. Missing master assets produce a provisional draft and keep approval blocked.

## Schedule cutover

The project starts with manual test runs. When the Vercel path passes a live test, copy vercel.scheduled.example.json over vercel.json and add CRON_SECRET to production. The example begins at 09:00 Pakistan time and advances at most one stage every five minutes in the 09:00–10:55 window. The unique database constraint admits one scheduled run per Pakistan calendar date. A leased stage can resume after an interruption. Coordinate the cutover with the existing 9 AM ChatGPT task to avoid duplicate daily drafting. Check the Vercel run logs and dashboard for the first scheduled result.

The dashboard stores a review packet for the owner. Approval records a payload fingerprint and the exact revision. Posting to LinkedIn remains a separate owner action.

## Tests

Run `npm test` for the local contracts. Start the app with `npm run dev` and run `npm run test:e2e` for Cypress. CI runs both. Cypress uses synthetic provider results to cover the UI and the real local endpoint to check unauthorized requests. A separate deployed smoke test exercises the AI and database providers with actual server configuration.

## Boards

Use `docs/BOARD.md` to create a GitHub Projects board and seed the release checklist.
