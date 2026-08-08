import { describe, expect, it } from 'vitest';
import { codeFromBytes, tokenFromBytes, inviteLink } from './employer-entry';

describe('codeFromBytes', () => {
  it('is 8 chars from the unambiguous alphabet by default', () => {
    const code = codeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toHaveLength(8);
    // No visually ambiguous I, L, O, U — a poster code typed on a phone.
    expect(code).not.toMatch(/[ILOU]/);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('is deterministic for the same bytes', () => {
    const bytes = new Uint8Array([31, 63, 95, 127, 159, 191, 223, 255]);
    expect(codeFromBytes(bytes)).toBe(codeFromBytes(bytes));
  });

  it('maps byte modulo 32 onto the alphabet (0→0, 31→Z, 32 wraps to 0)', () => {
    expect(codeFromBytes(new Uint8Array([0]), 1)).toBe('0');
    expect(codeFromBytes(new Uint8Array([31]), 1)).toBe('Z');
    expect(codeFromBytes(new Uint8Array([32]), 1)).toBe('0');
  });
});

describe('tokenFromBytes', () => {
  it('is URL-safe: no +, /, or = padding', () => {
    const token = tokenFromBytes(new Uint8Array([251, 255, 191, 0, 62, 63]));
    expect(token).not.toMatch(/[+/=]/);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trips distinct byte runs to distinct tokens', () => {
    const a = tokenFromBytes(new Uint8Array(24).fill(1));
    const b = tokenFromBytes(new Uint8Array(24).fill(2));
    expect(a).not.toBe(b);
  });
});

describe('inviteLink', () => {
  it('builds /join/<token> and tolerates a trailing slash on the origin', () => {
    expect(inviteLink('https://portal.richmond-afri.com', 'abc')).toBe(
      'https://portal.richmond-afri.com/join/abc',
    );
    expect(inviteLink('https://portal.richmond-afri.com/', 'abc')).toBe(
      'https://portal.richmond-afri.com/join/abc',
    );
  });
});
