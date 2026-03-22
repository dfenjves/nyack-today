# Nyack Today - Development Prompt Log

This file logs all prompts and major tasks performed during development sessions.

---

## Session: 2026-03-21

### Prompt 1: Timezone Bug Fix
**User:** "when a user submits an event for 9PM it shows up as 5PM."

**Action Taken:**
- Investigated timezone parsing in event submission flow
- Created `parseEasternTime()` utility function in `src/lib/utils/timezone.ts`
- Updated all event creation/update APIs to parse times as Eastern Time
- Files modified:
  - `src/app/api/submit-event/route.ts`
  - `src/app/api/admin/events/route.ts`
  - `src/app/api/admin/events/[id]/route.ts`
- Created test script: `scripts/test-timezone-fix.ts`
- Created documentation: `TIMEZONE_FIX.md`

**Outcome:** Fixed timezone conversion bug. Events now correctly display the time users submitted.

**Commit:** `7e9e591 - fix: correctly parse event times as Eastern Time instead of UTC`

---

### Prompt 2: Push to GitHub
**User:** "push to github"

**Action Taken:**
- Staged all timezone fix files
- Created commit with detailed message
- Resolved merge conflict with remote changes (email confirmation feature)
- Successfully pushed to main branch

**Outcome:** Changes pushed to GitHub successfully

---

### Prompt 3: Review GitHub Issues
**User:** "look at the current github issues"

**Action Taken:**
- Listed all open issues using `gh issue list`
- Viewed details for key issues (#30, #28, #23, #22, #9)
- Provided summary of current open issues organized by priority/category

**Key Findings:**
- Issue #9 (Submit an event) can be closed - feature already implemented
- Recent issues focus on: image upload, recurring events visibility, political events
- Multiple venue/scraper requests pending

---

### Prompt 4: Create Prompt Log
**User:** "As we move forward, I'd like a log file that logs all of the prompts given"

**Action Taken:**
- Created `PROMPT_LOG.md` to track all prompts and development activities
- Documented previous prompts from this session
- Set up format for future prompt tracking

---

### Prompt 5: Commit and Push Prompt Log
**User:** "commit and push it"

**Action Taken:**
- Staged `PROMPT_LOG.md`
- Committed with descriptive message
- Pushed to GitHub main branch

**Outcome:** Prompt log now tracked in version control for future reference

**Commit:** `0341c8b - docs: add prompt log to track development sessions`

---

## Template for Future Entries

### Prompt N: [Brief Title]
**User:** "[Exact prompt from user]"

**Action Taken:**
- [List of actions performed]
- [Files created/modified]
- [Commands run]

**Outcome:** [Result of the work]

**Commit:** [Commit hash and message if applicable]

---
