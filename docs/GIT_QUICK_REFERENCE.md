# Git Workflow Quick Reference

Quick reference guide for common Git operations in the VaidyaLink project.

## 📋 Table of Contents

- [Daily Workflow](#daily-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Common Commands](#common-commands)
- [Pull Requests](#pull-requests)
- [Troubleshooting](#troubleshooting)

## 🔄 Daily Workflow

### Starting a New Feature

```bash
# 1. Update develop branch
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/19-scanning-interface

# 3. Work on your feature
# ... make changes ...

# 4. Stage and commit
git add .
git commit -m "feat(frontend): add document scanning interface"

# 5. Push to remote
git push origin feature/19-scanning-interface

# 6. Create Pull Request on GitHub
```

### Working on Existing Feature

```bash
# 1. Switch to your branch
git checkout feature/19-scanning-interface

# 2. Get latest changes from develop
git fetch origin
git rebase origin/develop

# 3. Continue working
# ... make changes ...

# 4. Commit and push
git add .
git commit -m "feat(frontend): add image preview component"
git push origin feature/19-scanning-interface
```

## 🏷️ Branch Naming

### Format

```
<type>/<task-number>-<short-description>
```

### Examples

```bash
# Features
feature/8-document-processing-lambda
feature/19-scanning-interface
feature/25-multilingual-support

# Bug fixes
bugfix/123-fix-fhir-validation
bugfix/456-resolve-ocr-timeout

# Hotfixes
hotfix/789-fix-abdm-auth-error

# Documentation
docs/update
 Prettier formatting` |
| `refactor` | Code restructuring | `refactor(lambda): extract OCR logic` |
| `perf` | Performance | `perf(db): add patient query index` |
| `test` | Tests | `test(fhir): add transformer unit tests` |
| `build` | Dependencies | `build(deps): upgrade Next.js to 14.1` |
| `ci` | CI/CD | `ci: add security scanning workflow` |
| `chore` | Maintenance | `chore: update dependencies` |

### Common Scopes

```

frontend, backend, document, voice, fhir, abdm, hitl,
infra, api, auth, db, security, monitoring

````

### Examples

```bash
# Simple feature
git commit -m "feat(frontend): add camera capture component"

# Bug fix with details
git commit -m "fix(abdm): resolve consent timeout issue

Increased timeout from 5s to 10s to handle ABDM API latency
during peak hours.

Fixes #234"

# Breaking change
git commit -m "feat(api)!: migrate to Cognito authentication

BREAKING CHANGE: API now requires Cognito JWT tokens.
Update client authentication to use new token format."

# Multiple changes (use separate commits instead!)
# ❌ DON'T: git commit -m "fix: various fixes"
# ✅ DO: Make separate commits for each logical change
````

## 🛠️ Common Commands

### Branch Management

```bash
# List all branches
git branch -a

# Switch to branch
git checkout branch-name

# Create and switch to new branch
git checkout -b feature/new-feature

# Delete local branch
git branch -d feature/old-feature

# Delete remote branch
git push origin --delete feature/old-feature

# Rename current branch
git branch -m new-branch-name
```

### Syncing with Remote

```bash
# Fetch latest changes
git fetch origin

# Pull latest changes (fetch + merge)
git pull origin develop

# Pull with rebase (cleaner history)
git pull --rebase origin develop

# Push changes
git push origin feature/my-feature

# Force push (use with caution!)
git push origin feature/my-feature --force-with-lease
```

### Staging and Committing

```bash
# Stage all changes
git add .

# Stage specific files
git add src/components/Scanner.tsx

# Stage parts of a file (interactive)
git add -p

# Commit staged changes
git commit -m "feat(frontend): add scanner component"

# Commit with detailed message (opens editor)
git commit

# Amend last commit (change message or add files)
git add forgotten-file.ts
git commit --amend

# Amend without changing message
git commit --amend --no-edit
```

### Viewing History

```bash
# View commit history
git log

# View compact history
git log --oneline

# View history with graph
git log --oneline --graph --all

# View changes in last commit
git show

# View changes in specific commit
git show abc123

# View file history
git log -- path/to/file.ts
```

### Undoing Changes

```bash
# Discard changes in working directory
git checkout -- file.ts

# Unstage file (keep changes)
git reset HEAD file.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert abc123
```

### Stashing

```bash
# Stash current changes
git stash

# Stash with message
git stash save "WIP: scanner component"

# List stashes
git stash list

# Apply most recent stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{2}

# Delete stash
git stash drop stash@{0}

# Clear all stashes
git stash clear
```

### Rebasing

```bash
# Rebase current branch onto develop
git rebase develop

# Interactive rebase (clean up commits)
git rebase -i HEAD~5

# Continue after resolving conflicts
git rebase --continue

# Skip current commit
git rebase --skip

# Abort rebase
git rebase --abort
```

### Cherry-picking

```bash
# Apply specific commit to current branch
git cherry-pick abc123

# Cherry-pick multiple commits
git cherry-pick abc123 def456

# Cherry-pick without committing
git cherry-pick -n abc123
```

## 📝 Pull Requests

### Creating a PR

1. **Push your branch**

   ```bash
   git push origin feature/my-feature
   ```

2. **Go to GitHub** and click "Compare & pull request"

3. **Fill out PR template**
   - Clear title following commit convention
   - Complete description
   - Link related issues
   - Check all applicable boxes

4. **Request reviewers**
   - CODEOWNERS will be auto-assigned
   - Add additional reviewers if needed

5. **Wait for CI checks** to pass

### Updating a PR

```bash
# Make changes based on review
git add .
git commit -m "fix(review): address review comments"

# Push updates
git push origin feature/my-feature

# If you rebased, force push
git push origin feature/my-feature --force-with-lease
```

### PR Checklist

- [ ] Branch is up to date with base branch
- [ ] All CI checks passing
- [ ] Code reviewed by required reviewers
- [ ] No merge conflicts
- [ ] Commit messages follow conventions
- [ ] PR title follows conventions
- [ ] Documentation updated
- [ ] Tests added/updated

## 🔧 Troubleshooting

### Merge Conflicts

```bash
# 1. Update your branch
git fetch origin
git rebase origin/develop

# 2. Conflicts will be marked in files
# Edit files to resolve conflicts

# 3. Stage resolved files
git add resolved-file.ts

# 4. Continue rebase
git rebase --continue

# If stuck, abort and ask for help
git rebase --abort
```

### Accidentally Committed to Wrong Branch

```bash
# 1. Note the commit hash
git log --oneline

# 2. Switch to correct branch
git checkout correct-branch

# 3. Cherry-pick the commit
git cherry-pick abc123

# 4. Switch back to wrong branch
git checkout wrong-branch

# 5. Remove the commit
git reset --hard HEAD~1
```

### Pushed Sensitive Data

```bash
# ⚠️ IMMEDIATELY contact the team lead!

# 1. Remove from history (dangerous!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive-file" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Force push (requires admin access)
git push origin --force --all

# 3. Rotate any exposed credentials
# 4. Update .gitignore to prevent recurrence
```

### Forgot to Create Branch

```bash
# If you haven't committed yet
git stash
git checkout -b feature/my-feature
git stash pop

# If you already committed
git branch feature/my-feature  # Create branch at current commit
git reset --hard origin/develop  # Reset develop to remote
git checkout feature/my-feature  # Switch to new branch
```

### Need to Update PR After Force Push

```bash
# Someone force-pushed to your PR branch
git fetch origin
git reset --hard origin/feature/my-feature
```

### Rebase Conflicts Are Too Complex

```bash
# Abort rebase
git rebase --abort

# Use merge instead
git merge origin/develop

# Or ask for help from team lead
```

## 📚 Additional Resources

- [Full Git Workflow Guide](./GIT_WORKFLOW.md)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

## 🆘 Getting Help

- **Slack**: #vaidyalink-dev
- **Tech Lead**: @tech-lead
- **DevOps Team**: @devops-team

## 💡 Pro Tips

1. **Commit often**: Small, focused commits are easier to review and revert
2. **Pull before push**: Always pull latest changes before pushing
3. **Use descriptive branch names**: Include task number and brief description
4. **Write clear commit messages**: Future you will thank present you
5. **Review your own PR first**: Catch obvious issues before requesting review
6. **Keep PRs small**: Easier to review and less likely to have conflicts
7. **Use git stash**: Save work in progress when switching branches
8. **Sign your commits**: Required for audit compliance
9. **Never commit secrets**: Use .env files and AWS Secrets Manager
10. **Ask for help**: Better to ask than to mess up the repository

---

**Remember**: When in doubt, ask for help! It's better to ask than to accidentally cause issues in the repository.
