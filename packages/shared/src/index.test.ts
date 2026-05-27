import { describe, expect, it } from 'vitest';
import { ROLE_GROUPS, DEFAULT_PAYE_BANDS, NAPSA_RATE, NHIMA_RATE } from './index';

describe('shared barrel', () => {
  it('exposes the three sign-in role groups', () => {
    expect(ROLE_GROUPS.map((g) => g.key).sort()).toEqual(['employee', 'employer', 'staff']);
  });

  it('exposes seeded PAYE bands from the xlsm', () => {
    expect(DEFAULT_PAYE_BANDS).toHaveLength(4);
    expect(DEFAULT_PAYE_BANDS[0]).toMatchObject({ upTo: 4500, marginalRate: 0 });
    expect(DEFAULT_PAYE_BANDS.at(-1)).toMatchObject({ upTo: null, marginalRate: 0.375 });
  });

  it('exposes NAPSA and NHIMA rates', () => {
    expect(NAPSA_RATE).toBe(0.05);
    expect(NHIMA_RATE).toBe(0.01);
  });
});
