import { describe, it, expect, afterEach } from 'vitest';
import { todayKey, dailyCap } from './judgeBudget.js';

describe('todayKey', () => {
  it('formatta in YYYY-MM-DD (UTC)', () => {
    expect(todayKey(new Date('2026-08-17T22:52:00Z'))).toBe('2026-08-17');
  });

  it('usa la data UTC, non quella locale del server', () => {
    // 23:30 UTC del 17 resta 17 in UTC anche se un fuso locale +1/+2 lo farebbe
    // già rollare al 18 — il contatore deve essere deterministico indipendentemente
    // dal timezone della macchina che esegue il backend.
    expect(todayKey(new Date('2026-08-17T23:30:00Z'))).toBe('2026-08-17');
    expect(todayKey(new Date('2026-08-18T00:00:00Z'))).toBe('2026-08-18');
  });
});

describe('dailyCap', () => {
  const ORIGINAL = process.env.JUDGE_DAILY_LLM_CAP;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JUDGE_DAILY_LLM_CAP;
    else process.env.JUDGE_DAILY_LLM_CAP = ORIGINAL;
  });

  it('usa il default se la env var non è impostata', () => {
    delete process.env.JUDGE_DAILY_LLM_CAP;
    expect(dailyCap()).toBe(300);
  });

  it('legge il valore dalla env var quando valido', () => {
    process.env.JUDGE_DAILY_LLM_CAP = '50';
    expect(dailyCap()).toBe(50);
  });

  it('ignora valori non validi e ricade sul default', () => {
    for (const v of ['0', '-5', 'abc', '']) {
      process.env.JUDGE_DAILY_LLM_CAP = v;
      expect(dailyCap()).toBe(300);
    }
  });
});
