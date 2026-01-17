# Commit, Push, and Create PR

Commit all current changes, push to GitHub, and create a pull request.

## Steps

1. Run `git status` to see all changes (staged and unstaged)
2. Run `git diff` to understand what changed
3. Run `git log -3 --oneline` to see recent commit style
4. Stage all relevant changes with `git add`
5. Create a commit with a clear, descriptive message following the repo's style
6. Push to the current branch (create remote branch if needed with `-u`)
7. Create a pull request using `gh pr create` with:
   - A concise title summarizing the changes
   - A body with a Summary section (bullet points) and Test plan section
   - Include the footer: `🤖 Generated with [Claude Code](https://claude.ai/code)`

## Notes

- If there are no changes to commit, inform the user and stop
- If not on a feature branch, ask the user if they want to create one first
- Do not push directly to main/master - create a PR instead
