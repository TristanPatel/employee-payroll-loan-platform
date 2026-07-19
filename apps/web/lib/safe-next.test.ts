import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

// The exact loop scenario from UAT: middleware parks an unauthenticated
// employer on /sign-in?next=/admin; after sign-in the stale cross-role
// `next` must be dropped, not followed into a layout that rejects them.
describe('safeNext', () => {
  it('drops a stale cross-role next (the employer sign-in loop)', () => {
    expect(safeNext('/admin', '/employer')).toBe('/employer');
    expect(safeNext('/employer', '/admin')).toBe('/admin');
    expect(safeNext('/portal/apply', '/employer')).toBe('/employer');
  });

  it('falls back to home when next is missing or empty', () => {
    expect(safeNext(null, '/employer')).toBe('/employer');
    expect(safeNext('', '/admin')).toBe('/admin');
  });

  it('preserves in-role deep links, including query strings', () => {
    expect(safeNext('/portal/apply?employer=x', '/portal')).toBe('/portal/apply?employer=x');
    expect(safeNext('/admin/applications/1', '/admin')).toBe('/admin/applications/1');
    expect(safeNext('/employer?tab=history', '/employer')).toBe('/employer?tab=history');
    expect(safeNext('/employer', '/employer')).toBe('/employer');
  });

  it('rejects open-redirect shapes', () => {
    expect(safeNext('//evil.example.com', '/portal')).toBe('/portal');
    expect(safeNext('/\\evil.example.com', '/portal')).toBe('/portal');
    expect(safeNext('https://evil.example.com', '/portal')).toBe('/portal');
  });

  it('rejects prefix spoofs like /portalX', () => {
    expect(safeNext('/portalX', '/portal')).toBe('/portal');
    expect(safeNext('/administrator', '/admin')).toBe('/admin');
  });

  it('ignores query/hash when matching the home prefix', () => {
    expect(safeNext('/admin#frag', '/employer')).toBe('/employer');
    expect(safeNext('/employer#frag', '/employer')).toBe('/employer#frag');
  });
});
