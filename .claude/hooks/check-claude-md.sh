#!/bin/bash
# Stop hook: nudges Claude to review/update CLAUDE.md when files it documents
# have changed but CLAUDE.md itself hasn't been touched in the same working
# tree state. Fires at most once per distinct set of relevant changes so it
# can't loop forever if Claude decides no update is needed.

set -euo pipefail

session_id=$(jq -r '.session_id // "unknown"')

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo_root"

# Patterns for files whose changes typically require a CLAUDE.md update:
# commands, architecture, data model, key files, scraper tiers, design system.
relevant_files=$(git status --porcelain -- \
  'package.json' \
  'prisma/schema.prisma' \
  'src/lib/scrapers/' \
  'src/lib/db.ts' \
  'src/lib/utils/dates.ts' \
  'src/lib/utils/categories.ts' \
  'data-sources.md' \
  'src/app/globals.css' \
  2>/dev/null | awk '{print $2}' | sort)

if [ -z "$relevant_files" ]; then
  exit 0
fi

# If CLAUDE.md is already part of the current changes, assume it's been
# considered as part of this diff.
if git status --porcelain -- 'CLAUDE.md' 2>/dev/null | grep -q .; then
  exit 0
fi

hash=$(printf '%s' "$relevant_files" | shasum -a 1 | awk '{print $1}')
sentinel="/tmp/claude-md-nudge-${session_id}"

if [ -f "$sentinel" ] && [ "$(cat "$sentinel")" = "$hash" ]; then
  exit 0
fi

echo "$hash" > "$sentinel"

file_list=$(printf '%s\n' "$relevant_files" | sed 's/^/- /')

reason="Files that CLAUDE.md documents have changed in the working tree, but CLAUDE.md itself wasn't updated:
${file_list}

Check whether CLAUDE.md's Commands, Architecture, Data Model, Key Files, Scraper Tiers, or Design System sections are now stale, and update them if so. If nothing in CLAUDE.md actually needs to change, just say so briefly."

jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
