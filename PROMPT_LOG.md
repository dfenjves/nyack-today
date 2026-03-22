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

### Prompt 6: Work on Issue #30 - Event Image Upload
**User:** "Go ahead and create a new branch and start working on issue 30"

**Action Taken:**
- Created new branch `feature/event-image-upload`
- Added image URL input field to event submission form (`src/app/submit/page.tsx`)
- Added image preview that displays when user enters a URL
- Updated admin submission review page to display event images (`src/app/admin/submissions/page.tsx`)
- Added `imageUrl` field to EventSubmission TypeScript interface
- Verified EventCard component already supports displaying images (no changes needed)
- Ran build to verify all changes compile successfully

**Technical Details:**
- Implemented Phase 1: URL input (users can paste image URLs from external hosting)
- Phase 2 (future): Direct file upload with storage integration (Vercel Blob or similar)
- Image preview includes error handling (hides if image fails to load)

**Files Modified:**
- `src/app/submit/page.tsx` - Added image URL field with live preview
- `src/app/admin/submissions/page.tsx` - Added image display in submission cards

**Outcome:** Users can now submit image URLs with their events. Images appear in:
- Event submission form (with preview)
- Admin review panel (thumbnail + link)
- Event cards on homepage (already supported via EventCard component)

**Status:** Ready for testing and review. Branch: `feature/event-image-upload`

---

### Prompt 7: Direct File Upload for Event Submissions
**User:** "As a user, I want to be able to upload an image if I don't have the url for an event, during submission"

**Action Taken:**
- Entered planning mode to design file upload feature
- Explored codebase to understand current image implementation and infrastructure
- Asked user clarifying questions about storage service, file limits, and optimization preferences
- User selected: Vercel Blob storage, 5MB limit, auto-resize to 1200px, both URL and file upload options
- Created detailed implementation plan
- Installed `@vercel/blob` package
- Updated `.env.example` with `BLOB_READ_WRITE_TOKEN` documentation
- Created new API route: `/src/app/api/upload-image/route.ts`
  - Accepts multipart/form-data file uploads
  - Multi-layer validation (MIME type, actual format via Sharp, size, corrupt file detection)
  - Optimizes images: resize to 1200px max width, convert JPEG/PNG to WebP (preserve GIFs)
  - Uploads to Vercel Blob storage
  - Returns blob URL
- Updated `/src/app/submit/page.tsx`:
  - Added file upload state management
  - Created mode toggle (URL vs File Upload)
  - Implemented file input with drag-and-drop support
  - Added upload progress indicator
  - Created image preview for both modes
  - Modified form submission to upload file before creating event
  - Added client-side validation (type and size)
- Tested build successfully

**Technical Details:**
- **Security:** 3-layer validation (client MIME type, server MIME type, Sharp format verification)
- **Optimization:** WebP conversion (85% quality), resize only if > 1200px width
- **User Experience:** Toggle between URL paste and file upload, drag-and-drop, live preview
- **File size limit:** 5MB client and server enforcement
- **Supported formats:** JPEG, PNG, WebP, GIF

**Files Modified/Created:**
- **NEW:** `/src/app/api/upload-image/route.ts` - File upload endpoint
- **MODIFIED:** `/src/app/submit/page.tsx` - Added file upload UI and functionality
- **MODIFIED:** `/package.json` - Added `@vercel/blob` dependency
- **MODIFIED:** `/.env.example` - Added `BLOB_READ_WRITE_TOKEN` documentation

**Next Steps:**
- Set up Vercel Blob storage in Vercel Dashboard
- Pull environment variables locally: `vercel env pull .env.local`
- Test file upload end-to-end in local development
- Deploy to production and verify Vercel Blob configuration

**Outcome:** Users can now upload images directly from their devices OR paste image URLs. Images are automatically optimized and stored in Vercel Blob storage. The build passes successfully with the new feature.

**Status:** Ready for local testing and deployment

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
