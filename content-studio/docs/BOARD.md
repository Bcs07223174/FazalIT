# Fazal IT release board

Create a GitHub Projects board for the repository owner. Use columns **Backlog**, **In progress**, **Blocked**, and **Done**. The authenticated GitHub CLI account needs project write access.

```sh
gh auth refresh -s project
gh project create --owner @me --title "Fazal IT Content Studio"
```

Take the project number returned by GitHub. Run `node scripts/seed-board.mjs @me PROJECT_NUMBER` from content-studio to add the checklist. Configure a Board layout grouped by Status in the project, then move items according to their verified completion.

| Card | Acceptance criteria |
|---|---|
| Run CI | Node contract tests and Cypress checks pass in GitHub Actions. |
| Configure brand kit | The approved PNG, its fingerprint and the confirmed accent color are present. |
| Provision Vercel and Neon | An eligible Vercel team hosts the app. A private database has the schema and Vercel has scoped secrets. |
| Verify live generation | Five stages run on one real current story. Review opens sources and persists the graphic, caption and alt text. |
| Verify revision approval | Brand holds and stale payloads block approval. The exact all-pass revision records owner approval. |
| Cut over daily scheduling | One 09:00 Pakistan run generates a visible packet. Retry leaves a single scheduled draft. |
