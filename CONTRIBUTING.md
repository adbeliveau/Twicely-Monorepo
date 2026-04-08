# Contributing — Twicely Mono

Two-developer workflow for working on `master` without stepping on each other.

## Golden Rules

1. **Never push directly to `master`.** Always work on a branch and open a PR.
2. **Pull before you push.** Always `git pull --rebase origin master` before pushing your branch.
3. **One PR = one focused change.** Small PRs merge fast and conflict rarely.
4. **Green CI before merge.** Wait for typecheck/lint/test/build to pass.
5. **Talk first if you're touching shared files** (schema, CLAUDE.md, root configs, shared packages).

## Daily Workflow

### 1. Start a new task

```bash
git checkout master
git pull origin master
git checkout -b feat/<short-name>     # or fix/<short-name>, chore/<short-name>
```

Branch naming:
- `feat/helpdesk-views` — new feature
- `fix/login-redirect` — bug fix
- `chore/update-deps` — maintenance
- `refactor/casl-helpers` — refactor

### 2. Work + commit locally

```bash
# ...edit files...
git add <files>
git commit -m "Short message describing the why"
```

Commit early, commit often. Local commits are free.

### 3. Sync with master before pushing

```bash
git fetch origin
git rebase origin/master
# resolve any conflicts, then:
git rebase --continue
```

If rebase gets messy:
```bash
git rebase --abort           # back out
git merge origin/master      # use merge instead
```

### 4. Push the branch

```bash
git push -u origin feat/<short-name>
```

The `-u` only needed the first time. After that just `git push`.

### 5. Open a PR

On GitHub: open a Pull Request from your branch into `master`.

CI will automatically run:
- `pnpm install`
- `npx turbo typecheck`
- `npx turbo lint`
- `npx turbo test`
- `npx turbo audit`
- `npx turbo build --filter=@twicely/web`

**All checks must pass before merging.**

### 6. Merge

Use **Squash and merge** on GitHub (keeps `master` history linear and clean).

Then locally:
```bash
git checkout master
git pull origin master
git branch -d feat/<short-name>     # delete local branch
```

## Avoiding Merge Conflicts (Two-Dev Reality)

- **Carve out ownership**: agree out loud who owns which area for the day. e.g., "I'm on helpdesk all day, you're on storefront."
- **Sync at least 2x/day**: `git fetch && git rebase origin/master` on your branch.
- **Avoid touching the same file in parallel.** If you must, message each other.
- **Shared files = high-risk**: schema (`packages/db/src/schema/`), `CLAUDE.md`, `pnpm-lock.yaml`, root `package.json`, `apps/web/CLAUDE.md`. Coordinate before editing.
- **Lockfile drift**: if both of you `pnpm add`, the lockfile WILL conflict. Whoever rebases second usually has to delete `pnpm-lock.yaml`, run `pnpm install`, and re-commit.

## Resolving a Merge Conflict

```bash
git fetch origin
git rebase origin/master
# Git will pause on conflicts. Open the files, look for <<<<<<< markers, fix them.
git add <fixed-files>
git rebase --continue
git push --force-with-lease    # ONLY on your own branch, NEVER on master
```

`--force-with-lease` is safer than `--force`: it refuses to overwrite if someone else pushed to your branch.

## Running Locally Before Pushing

```bash
npx turbo typecheck                      # ~30s
npx turbo test                           # ~2-3min
npx turbo build --filter=@twicely/web    # ~4min
```

If you don't run these locally, CI will catch them — but the round-trip is slower.

## Hot-fixing master

If `master` is broken and needs an immediate fix:

```bash
git checkout master
git pull
git checkout -b fix/hotfix-<name>
# fix
git push -u origin fix/hotfix-<name>
# open PR, merge as soon as CI is green
```

Don't bypass CI even for hotfixes — the 5 minutes of waiting is cheaper than pushing a second broken commit.

## Recommended GitHub Settings

On `github.com/adbeliveau/Twicely-Monorepo` → Settings → Branches:

1. Add a branch protection rule for `master`:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass (`CI / Install, Typecheck, Lint, Test, Audit, Build`)
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings (or allow only the repo owner)

This prevents accidental direct pushes and red merges.

## Quick Reference

| Task                          | Command                                              |
|-------------------------------|------------------------------------------------------|
| Start new branch              | `git checkout -b feat/<name>`                        |
| Sync with master              | `git fetch && git rebase origin/master`              |
| First push                    | `git push -u origin feat/<name>`                     |
| Subsequent pushes             | `git push`                                           |
| Force push (your branch only) | `git push --force-with-lease`                        |
| Delete merged branch          | `git branch -d feat/<name>`                          |
| Local typecheck               | `npx turbo typecheck`                                |
| Local test                    | `npx turbo test`                                     |
| Local build                   | `npx turbo build --filter=@twicely/web`              |
