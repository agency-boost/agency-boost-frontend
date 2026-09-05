import '@testing-library/jest-dom/vitest';

// The API origin is required, not optional — `apiOrigin()` throws without it, which is
// deliberate: a build that silently calls a relative URL is worse than one that fails.
process.env.NEXT_PUBLIC_API_ORIGIN ??= 'http://api.test';
