import { describe, it, expect } from 'vitest';
import { validateUsername, validateEmail, validatePassword, normalizeEmail } from './validators.js';

describe('validateUsername', () => {
  it('accetta username validi', () => {
    for (const u of ['abc', 'Ramuh', 'kev_97', 'mr.smith', 'a-b-c', 'x'.repeat(24)]) {
      expect(validateUsername(u)).toBeNull();
    }
  });
  it('rifiuta username invalidi', () => {
    for (const u of ['ab', 'x'.repeat(25), 'con spazio', 'emoji🔥', 'più', 'nome@dominio', '', null, undefined, 42]) {
      expect(validateUsername(u)).toBeTruthy();
    }
  });
});

describe('validateEmail', () => {
  it('accetta email valide', () => {
    for (const e of ['a@b.it', 'ckappa97@gmail.com', 'x.y+z@sub.domain.co']) {
      expect(validateEmail(e)).toBeNull();
    }
  });
  it('rifiuta email invalide', () => {
    for (const e of ['', 'nodominio', 'a@b', 'a b@c.it', 'a@.it', null, undefined, `${'x'.repeat(250)}@a.it`]) {
      expect(validateEmail(e)).toBeTruthy();
    }
  });
});

describe('validatePassword', () => {
  it('accetta password valide', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('x'.repeat(128))).toBeNull();
  });
  it('rifiuta password troppo corte o lunghe', () => {
    expect(validatePassword('1234567')).toBeTruthy();
    expect(validatePassword('x'.repeat(129))).toBeTruthy();
    expect(validatePassword('')).toBeTruthy();
    expect(validatePassword(null)).toBeTruthy();
  });
});

describe('normalizeEmail', () => {
  it('trim + lowercase', () => {
    expect(normalizeEmail('  Foo@Bar.IT ')).toBe('foo@bar.it');
  });
  it('lascia passare i non-stringa senza esplodere', () => {
    expect(normalizeEmail(null)).toBe(null);
    expect(normalizeEmail(undefined)).toBe(undefined);
  });
});
