import { corsOptions, parseCorsOrigins } from './cors';

describe('CORS allowlist', () => {
  it('is permissive (development) when CORS_ORIGINS is unset or blank', () => {
    expect(parseCorsOrigins(undefined)).toBeNull();
    expect(parseCorsOrigins('')).toBeNull();
    expect(parseCorsOrigins(' , ,')).toBeNull();
    expect(corsOptions(undefined)).toEqual({});
  });

  it('restricts to the listed origins, trimming spaces and trailing slashes', () => {
    expect(parseCorsOrigins('https://app.example.com/, http://localhost:3000 ')).toEqual([
      'https://app.example.com',
      'http://localhost:3000',
    ]);
    expect(corsOptions('https://app.example.com')).toEqual({ origin: ['https://app.example.com'] });
  });

  it('does not turn a wildcard into an allow-all entry', () => {
    // "*" is kept as a literal origin string, which never matches a real browser origin
    expect(corsOptions('*')).toEqual({ origin: ['*'] });
  });
});
