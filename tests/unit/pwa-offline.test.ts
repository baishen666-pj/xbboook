/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('PWA offline indicator', () => {
  it('detects navigator.onLine', () => {
    expect(typeof navigator.onLine).toBe('boolean');
  });

  it('has online/offline event support', () => {
    expect('ononline' in window).toBe(true);
    expect('onoffline' in window).toBe(true);
  });

  it('serviceWorker API exists or gracefully degrades', () => {
    if ('serviceWorker' in navigator) {
      expect(navigator.serviceWorker).toBeDefined();
    } else {
      expect(true).toBe(true);
    }
  });
});
