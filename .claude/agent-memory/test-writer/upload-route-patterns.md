---
name: Upload Route Testing Patterns
description: Patterns for testing the /api/upload route handler, including rate limiting, CASL gating, and meetup-photo validation
type: feedback
---

## /api/upload route mocking

The upload route imports from multiple modules. All mocks must use `vi.hoisted()` so they are available in factory closures:

```typescript
const { mockAuthorize, mockAbility, mockDbSelect, mockUploadMeetupPhoto,
        mockValidateImageBytes, mockDetectImageType, mockIsR2Configured } = vi.hoisted(() => {
  // ...declarations
});

vi.mock('@/lib/casl/authorize', () => ({ authorize: (...args) => mockAuthorize(...args) }));
vi.mock('@/lib/upload/validate', () => ({
  validateImageBytes: (...args) => mockValidateImageBytes(...args),
  detectImageType: (...args) => mockDetectImageType(...args),
  getExtension: vi.fn().mockReturnValue('jpg'),
}));
vi.mock('@/lib/storage/r2-client', () => ({
  isR2Configured: (...args) => mockIsR2Configured(...args),
  extractKeyFromUrl: vi.fn(),
  R2_PUBLIC_URL: 'https://cdn.twicely.com',
}));
```

In `beforeEach`, call `vi.resetAllMocks()` and then re-apply all defaults:
- `mockValidateImageBytes.mockReturnValue({ valid: true })`
- `mockDetectImageType.mockReturnValue('jpeg')`
- `mockIsR2Configured.mockReturnValue(true)`

## Rate limit contamination

The upload route uses an in-memory `Map` (`uploadCounts`) for rate limiting — it is module-scoped and persists across tests in the same worker.

**Problem**: A rate limit test that calls POST 21 times exhausts the limit for that userId, causing subsequent tests for the same userId to get 429 instead of the expected response.

**Fix**: Use a unique userId ONLY for the rate limit test:
```typescript
it('returns 429 when rate limit is exceeded', async () => {
  const rateLimitUserId = 'buyer-ratelimit-unique-001'; // distinct from all other test userIds
  mockAuthorize.mockResolvedValue({
    session: { userId: rateLimitUserId, ... },
    ability: mockAbility,
  });
  // short-circuit image processing to make calls cheap
  mockValidateImageBytes.mockReturnValue({ valid: false, error: 'stop' });
  // ... loop 21 times
});
```

Also: `vi.resetModules()` does NOT reset the in-memory rate limit Map — only using a different userId isolates the test.

## video / video-thumbnail CASL gate — dispatch handler mocks

The `/api/upload` route dispatches `type=video` and `type=video-thumbnail` to dedicated handlers (`video-handler.ts`). When testing the route (not the handlers), mock `../video-handler` using `vi.hoisted` and re-apply return values in `beforeEach` (since `vi.resetAllMocks()` clears them):

```typescript
const { mockHandleVideoUpload, mockHandleVideoThumbnailUpload } = vi.hoisted(() => ({
  mockHandleVideoUpload: vi.fn(),
  mockHandleVideoThumbnailUpload: vi.fn(),
}));

vi.mock('../video-handler', () => ({
  handleVideoUpload: (...args: unknown[]) => mockHandleVideoUpload(...args),
  handleVideoThumbnailUpload: (...args: unknown[]) => mockHandleVideoThumbnailUpload(...args),
}));

// In beforeEach (after vi.resetAllMocks()):
mockHandleVideoUpload.mockResolvedValue(
  new Response(JSON.stringify({ success: true, video: { id: 'v-1', url: '...' } }), { status: 200 })
);
```

The route's CASL check for video/video-thumbnail uses `ability.can('create', 'Listing')` — same as listing uploads.

## meetup-photo route — position calculation

The route uses `currentCount = tx.meetupPhotoUrls.length` as the `position` argument to `uploadMeetupPhoto`. Test:
```typescript
mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ meetupPhotoUrls: ['url1', 'url2'] })]) as never);
await POST(req);
const callArgs = mockUploadMeetupPhoto.mock.calls[0] as [string, Buffer, number];
expect(callArgs[2]).toBe(2); // position = existing count
```
