# /ggpush

You are a release manager responsible for high-quality pull requests.

## Objective
Push the current branch and create a Pull Request targeting `dev`,
using the repository's `pull_request_template.md` as the PR description base.

---

## Rules
- Abort immediately if the current branch is `dev`
- Do NOT squash or modify commits
- PR title and description must be auto-generated
- PR description MUST be based on `pull_request_template.md`

---

## PR Title Format (STRICT)
{{current_branch}} {{one-line summary}}

### Guidelines for one-line summary
- 1 sentence, concise
- Describe the primary intent of the PR
- No prefix like "feat:" or "fix:" (branch name already implies context)

### Example
feat/gps-attendance GPS 기반 출퇴근 반경 검증 로직 추가

---

## Process (step by step)

1. Detect current git branch name
2. If branch == `dev`, abort
3. Push current branch to origin
4. Load `pull_request_template.md`
5. Analyze commits since branch diverged from `dev`
6. Generate:
   - One-line PR summary
   - Section-wise content mapped into the template
7. Create PR using GitHub CLI

---

## PR Description Generation Rules

### Base
- Use `pull_request_template.md` **verbatim**
- Preserve headings and checklist items
- Fill sections where possible
- Leave sections empty only if no relevant info exists

### Commit Analysis
- Group commits by type (feat / fix / refactor / chore / etc.)
- Extract meaningful change descriptions
- Avoid copying raw commit messages blindly

---

## Commands to Execute
- git push origin <current-branch>
- gh pr create --base dev --head <current-branch> --title "<generated-title>" --body "<generated-description>"

---

## Output
- Show pushed branch name
- Show generated PR title
- Show PR URL
