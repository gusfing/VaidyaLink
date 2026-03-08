# Property-Based Tests for Authentication Middleware

## Overview

This directory contains property-based tests for the authentication middleware using fast-check.

## Running the Tests

Before running the tests, ensure dependencies are installed:

```bash
# From the project root
pnpm install

# Or from the backend/api-handler directory
pnpm install
```

Then run the tests:

```bash
# Run all tests
pnpm test

# Run only property tests
pnpm test __properties__

# Run with watch mode
pnpm test:watch
```

## Test Coverage

The property tests in `auth.properties.test.js` verify the following properties:

### Property 28: Authentication Header Inclusion

- Validates that requests without Authorization header are rejected with 401
- Validates that requests with malformed Authorization header are rejected
- Validates that requests with proper Bearer token format are accepted
- **Validates: Requirement 8.1**

### Property 29: Invalid Token Rejection

- Validates that invalid JWT tokens are rejected with 401
- Validates that tokens with invalid signatures are rejected
- Validates that malformed tokens are rejected
- **Validates: Requirement 8.2**

### Property 30: Token Expiration Extraction

- Validates that expired tokens are rejected with TOKEN_EXPIRED code
- Validates that tokens with future expiration are accepted
- Validates that expiration checking is consistent
- **Validates: Requirement 8.6**

### Property 31: User Identity Extraction

- Validates that user identity (userId, email, username) is extracted from valid tokens
- Validates that both cognito:username and standard username claims are handled
- Validates that groups are extracted from token claims
- Validates that tokens without groups have empty groups array
- **Validates: Requirement 8.7**

### Additional Property: Consistent Error Response Format

- Validates that all authentication errors return consistent JSON format
- Validates that error responses include error, code, details, and requestId fields

## Dependencies

The property tests require the following dev dependencies:

- `fast-check`: ^3.15.0 - Property-based testing framework
- `supertest`: ^6.3.3 - HTTP assertion library (for integration tests)
- `jest`: ^29.7.0 - Test runner

These are already specified in `package.json`.

## Test Strategy

Property-based tests use randomly generated inputs to verify that properties hold across a wide range of scenarios. Each test runs 50-100 iterations with different random inputs to ensure robustness.

The tests mock the `jwks-rsa` library to avoid external dependencies during testing, and use `jest.spyOn` to control JWT verification behavior for different test scenarios.
