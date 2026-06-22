# x401 Go-Public Playbook

**Repo:** `proof/x401` (currently `internal`) → flip to **public**
**Author:** Ember, for Trevor — 2026-06-22
**Durable home:** INFRA-2263 description (this MD is the working copy; kept **outside** the repo so it never publishes)
**Standard:** [Publishing Open Source](https://notarize.atlassian.net/wiki/spaces/EN/pages/5360812039/Publishing+Open+Source) (Confluence 5360812039)

> ⚠️ This file lives at `~/proof/x401-go-public-playbook.md` — a **sibling** of the repo, not inside it. Do not move it into `~/proof/x401/`; it references internal tickets/people/systems.

---

## Decisions already made (do not re-litigate)

- **Rewrite `main` in place; do NOT recreate the repo.** Trevor accepts the residual risk.
- **Rewriting `main` does NOT purge PR refs.** The sensitive commits remain reachable via `refs/pull/{1,6,7}/head` and commit-by-SHA views after the force-push. GitHub's only full purge = delete the PRs + contact Support. **Trevor's call: good-faith cleanup, accept residual PR-ref leaks** — nothing terribly sensitive (no secrets/PII; the notable item is just an AI-agentic "superpowers" build trail).
- **Keep PR #7** (`dc-ification`, Daniel Buchner). It lands **after** going public.
- **"Obliterate all other PRs"** = branch cleanup. #2–#6/#8/#9 are merged, #1 is closed; only #7 is open.

## What the cleanup actually targets

Current `main` tip is clean. **History is not.** Three commits carry internal infra detail (CloudFront/S3, Terraform, Jenkinsfile, OpenTofu, internal monorepo layout, local `~/Documents` paths, the internal **"superpowers"** agentic-dev framework):

| Commit | Note |
|---|---|
| `311c22d` | Add Cloudflare Pages migration design spec |
| `a173687` | Add Cloudflare Pages migration implementation plan |
| `466a423` | `push` (deletes them) |

Files (history blobs only — already deleted from the tree):
- `docs/superpowers/plans/2026-05-07-cloudflare-pages-migration.md`
- `docs/superpowers/specs/2026-05-07-cloudflare-pages-migration-design.md`

Squashing `main` to a single clean commit drops these from `main`'s reachable history.

## Preconditions / state snapshot (2026-06-22)

- `main` branch protection **ON** (INFRA-2005): `enforce_admins=true`, `allow_force_pushes=false`, require PR + **code-owner** review (1), dismiss stale, conversation-resolution required. → **blocks the force-push until lifted.**
- GHAS **all disabled** (secret scanning, push protection, dependabot). Standard wants push protection ON before public.
- `allow_forking=false` (org disallows forking on private/internal repos → enable **after** the flip).
- Open PRs: only **#7**. Stale remote branches: `chore/remove-password-gate`, `chore/untrack-claude-settings`, `cloudflare/workers-autoconfig`. Keep: `main`, `dc-ification`.
- External collaborator **`bhushitagarwal-circle`** (Circle) has **push** — decision pending (fork-and-PR vs keep).
- Site already un-gated (PR #9 removed the Cloudflare Function password gate). Canonical spec URL for this repo = **`x401.proof.com/spec`** (`x401.id` is a separate property/repo, not a typo).

---

## Phase 0 — Back up first (nothing is truly lost)

```
cd ~/proof/x401
git fetch origin
git bundle create ~/x401-history-backup.bundle --all      # full history incl. all branches + tags
git tag backup/main-pre-rebase     origin/main
git tag backup/dc-ification        origin/dc-ification
```

Trevor also did this:
```
~/proof/x401.backup % git clone git@github.com:proof/x401.git
Cloning into 'x401'...
```

## Phase 1 — Lift branch protection (so the force-push can land)

```
gh api -X DELETE repos/proof/x401/branches/main/protection
```
(Restored in Phase 4. `enforce_admins=true` means even you can't force-push until this is removed.)

## Phase 2 — Rewrite `main` to one clean commit

Squash-to-orphan is the simplest method that guarantees `docs/superpowers/*` leave `main`'s history:

```
cd ~/proof/x401
git switch main
git reset --hard origin/main                 # ensure synced with remote
git checkout --orphan clean-main             # new parentless branch; working tree kept intact
git add -A
git commit -m "x401: HTTP Proof Requirement Protocol specification"
git branch -M main                           # rename clean-main → main, replacing old main
git push --force-with-lease origin main
```
If `--force-with-lease` balks after the ref surgery, fall back to `--force-with-lease=main:$(git rev-parse backup/main-pre-rebase)`; plain `--force` is acceptable here since you own the rewrite.

## Phase 3 — Verify the expunge (on the rewritten `main`)

```
git log --oneline                                         # expect a single commit
git log --all --source -- docs/superpowers                # expect EMPTY for main (PR refs may still show — accepted)
git grep -niE "superpowers|cloudfront|tofu apply|Jenkinsfile|/Users/|/Documents/" $(git rev-parse HEAD)
```
The `git log` for `docs/superpowers` should show nothing reachable from `main`. (It will still resolve via `refs/pull/*` — that's the accepted residual.)

## Phase 4 — Restore branch protection

```
gh api -X PUT repos/proof/x401/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```
Verify: `gh-api-ro repos/proof/x401/branches/main/protection`

## Phase 5 — Prune stale branches ("obliterate other PRs")

No open PRs to close besides #7. Delete the stale remotes:
```
git push origin --delete chore/remove-password-gate chore/untrack-claude-settings cloudflare/workers-autoconfig
git tidy        # prune local stale refs
```

## Phase 6 — Reconcile Daniel's PR #7 (lands after public)

Rewriting `main` severs #7's common ancestor, so it needs updating before it merges. Two points:

- **Protect `main` at merge time → squash-merge #7.** A normal merge commit would drag `dc-ification`'s old ancestry (incl. the `superpowers` commits) back into `main`'s history. **Squash-merge collapses #7 to a single net-diff commit — no historical blobs re-enter `main`.**
- **Bringing #7 up to date is Daniel's to do** (his branch). Per your standing *merge-don't-rebase* preference, the default is: he merges the new `main` into `dc-ification`, resolves (conflicts only in `README.md`/`package.json`; `spec.md` is clean), then it squash-merges. If he'd rather also strip the `superpowers` ancestor from his own branch, rebasing `dc-ification` onto the new `main` does that too — his call.

> Heads-up for Daniel: PR #7's title/commit *"…changes requested from Google, OpenAI, and Okta's FIDO reps"* goes **public** when it lands. Reword if that shouldn't be public (or keep as intentional social proof).

## Phase 7 — Pre-flip controls

1. **GHAS push protection ON** (standard requires before public):
   ```
   gh api -X PATCH repos/proof/x401 \
     -f 'security_and_analysis[secret_scanning][status]=enabled' \
     -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled' \
     -f 'security_and_analysis[dependabot_security_updates][status]=enabled'
   ```
   If this 422s on the `internal` repo (GHAS licensing), do it **immediately after** the public flip — secret scanning is free on public repos.
2. **Cloudflare Pages preview lockdown** (dashboard — `cf-ro` is broken in this env): Pages project `x401` → Settings → Builds & deployments → **Preview deployments** → restrict to production branch / require approval. Otherwise a fork PR can publish an ungated `*.pages.dev` preview and run arbitrary repo code on Cloudflare infra.
3. **InfoSec sign-off** — John Heasman (or delegate). You hold CloudInfra. Legal (Apache 2.0) already approved (PRL-5153).
4. **External collaborator decision** — `bhushitagarwal-circle` (Circle) has push. On a public repo, partners normally move to fork-and-PR. Decide: revoke to read, or keep push.

## Phase 8 — Flip to public

```
gh repo edit proof/x401 --visibility public --accept-visibility-change-consequences
```

## Phase 9 — Post-flip

1. **Enable forking** (was rejected while internal):
   ```
   gh api -X PATCH repos/proof/x401 -F allow_forking=true
   ```
2. If GHAS was deferred in Phase 7, enable it now (free on public).
3. Confirm branch protection survived the flip (`gh-api-ro repos/proof/x401/branches/main/protection`).
4. **Daniel lands PR #7 via squash-merge.**
5. Re-verify `x401.proof.com/spec` serves ungated and the `github.com/proof/x401` links resolve.

---

## Residual (knowingly accepted)

- `docs/superpowers/*` design/plan docs and the three commits (`311c22d`/`a173687`/`466a423`) remain fetchable via `refs/pull/{1,6,7}/head` and commit-by-SHA URLs even after the force-push. Full purge would require deleting those PRs + GitHub Support. **Accepted as good-faith effort** — no secrets/PII; notable-not-embarrassing.
- Mixed author identities in old history (`@notarize.com`, personal gmail, `nalgenewaterbottle`) — "we have to live with these."

## References

- Standard: Confluence 5360812039 · Umbrella: INFRA-1220 · Legal: PRL-5153
- This repo's go-public ticket: **INFRA-2263** (durable runbook) · gate removal: **INFRA-2265** · protection: **INFRA-2005**
- Prior session: `ks/session-audit/detailed/20260622-143800-x401-go-public.md`
- Audit playbook: `ks/knowledge/public-repo-security-audit.md`
- Repo family: Confluence 5710544897 ("x401 family of repos")
