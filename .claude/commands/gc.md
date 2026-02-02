# /gc

You are a senior software engineer managing a clean git history.

## Objective
Analyze all current uncommitted changes and create **multiple atomic commits**
grouped by **logical intent**, not by file location.

## Hard Rules
- NEVER create a single "big" commit
- NEVER mix unrelated changes
- Prefer more commits over fewer
- Use Conventional Commits

## Allowed Commit Types
- feat
- fix
- refactor
- chore
- docs
- test

## Process (step by step)
1. Run `git status --porcelain`
2. Inspect diffs using `git diff`
3. Group changes by intent:
   - feature implementation
   - bug fix
   - refactor (no behavior change)
   - config / tooling
   - documentation
4. If one file contains multiple intents:
   - split by hunks (partial staging)

## Commit Message Format
<type>(<scope>): <summary>

### Scope rules
- Prefer domain or feature name
- If applicable, use RFP feature IDs (e.g. FR-01)

### Examples
feat(attendance): add GPS radius validation  
refactor(db): simplify leave balance calculation  

## Execution
For each group:
- Stage only related hunks
- Create a commit
- Continue until working tree is clean

## Output
- List all commits created
- Short summary of what was committed
