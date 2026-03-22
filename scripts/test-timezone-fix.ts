#!/usr/bin/env ts-node

/**
 * Test script to verify timezone parsing works correctly
 * Run with: npx ts-node scripts/test-timezone-fix.ts
 */

import { parseEasternTime } from '../src/lib/utils/timezone.js'

console.log('Testing timezone parsing...\n')

// Test case: User submits 9PM on March 21, 2026
const userInput = '2026-03-21T21:00'
console.log(`User input: ${userInput} (9PM Eastern)`)

const parsedDate = parseEasternTime(userInput)
console.log(`Parsed as UTC: ${parsedDate.toISOString()}`)

// Display it back in Eastern Time to verify
const displayedInEastern = parsedDate.toLocaleString('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})
console.log(`Displayed in Eastern: ${displayedInEastern}`)

const timeOnly = parsedDate.toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/New_York',
})
console.log(`Time displayed to user: ${timeOnly}`)

console.log('\n✅ Expected: 9:00 PM')
console.log(`✅ Actual: ${timeOnly}`)
console.log(timeOnly === '9:00 PM' ? '\n✅ TEST PASSED!' : '\n❌ TEST FAILED!')
