# Test Suite for ghas-to-labels

## Overview

Comprehensive test suite covering label formatting, GitHub API interactions, and end-to-end workflows for the GHAS alert labeling action.

## Test Files

### `__tests__/labels.test.ts` (66 lines, 11 tests)
Tests for label utility functions:
- `labelName()` - Format label names (S-5, C-3, D-10)
- `findExistingLabelByPrefix()` - Pattern matching for existing labels

**Coverage:**
- ✅ All three prefixes (S, C, D)
- ✅ Zero counts, large counts (9999)
- ✅ Empty arrays, partial prefix matching
- ✅ Multiple matching labels

---

### `__tests__/github.test.ts` (341 lines, 33 tests)
Tests for GitHub API functions with mocked Octokit:

**Functions tested:**
- `getOrgRepos()` - Fetch and filter org repositories
- `getSecurityAlertCount()` - Secret scanning alert counts
- `getCodeScanningAlertCount()` - Code scanning alert counts
- `getDependabotAlertCount()` - Dependabot alert counts
- `upsertLabel()` - Create/update labels
- `getExistingLabels()` - Fetch current labels

**Critical edge cases:**
- ✅ 404 responses (GHAS not enabled)
- ✅ 403 responses (permission denied)
- ✅ Pagination with 100+ alerts across multiple pages
- ✅ Archived repo filtering
- ✅ Empty result sets
- ✅ 500 errors (should throw)

---

### `__tests__/integration.test.ts` (346 lines, 5 scenarios)
End-to-end workflow tests using `processRepoLabels()`:

**Scenarios:**
1. **Happy path** - New labels on repo with alerts (5/2/10)
2. **Idempotency** - Re-running with unchanged counts
3. **Count changed** - Label update (S-3 → S-7)
4. **Dry-run mode** - Logs actions without API calls
5. **GHAS not enabled** - Zero-count handling

---

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test __tests__/labels.test.ts

# Watch mode (useful during development)
npm test -- --watch
```

## Coverage Targets

Configured in `jest.config.js`:
- **Branches:** 80%
- **Functions:** 90%
- **Lines:** 90%
- **Statements:** 90%

## Mock Strategy

### Octokit Mocking
All tests use Jest mocks for Octokit. Key pattern:

```typescript
const createMockOctokit = () => ({
  rest: { /* REST API endpoints */ },
  paginate: {
    iterator: jest.fn()  // Returns async iterators
  },
  graphql: jest.fn()
})
```

### Iterator Pattern
GitHub API responses use async iterators for pagination:

```typescript
const mockIterator = {
  async *[Symbol.asyncIterator]() {
    yield { data: [/* page 1 */] }
    yield { data: [/* page 2 */] }
  }
}
mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
```

## Key Edge Cases Covered

### 1. GHAS Not Enabled (404)
When secret scanning/code scanning/Dependabot is not enabled, API returns 404.  
**Expected:** Return count of 0, continue processing other alert types.

### 2. Permission Denied (403)
When token lacks GHAS permissions.  
**Expected:** Return count of 0 with warning log.

### 3. Label Idempotency
When action runs multiple times with unchanged counts.  
**Expected:** No unnecessary API calls or label churn.

### 4. Dry-Run Mode
When `dry-run: true` is set.  
**Expected:** Log intended actions, make NO label modification API calls.

### 5. Archived Repos
When org contains archived repositories.  
**Expected:** Skip archived repos entirely.

## Edge Cases NOT Covered

See `.squad/decisions/inbox/mother-test-strategy.md` for architectural considerations:

- ❌ Enterprise GraphQL query complexity (basic mock only)
- ❌ Partial failure scenarios (5/10 repos fail)
- ❌ Rate limit exceeded handling
- ❌ Network timeout/retry logic
- ❌ Concurrent processing race conditions

## Test Metrics

- **Total Lines of Test Code:** 753
- **Total Test Cases:** 77 (describe + it blocks)
- **Test Files:** 3
- **Mocked API Endpoints:** 12+

## Contributing

When adding new features:
1. Add unit tests for new functions in appropriate test file
2. Add integration test scenario if workflow changes
3. Update this README if new edge cases discovered
4. Ensure coverage targets are met: `npm test -- --coverage`
