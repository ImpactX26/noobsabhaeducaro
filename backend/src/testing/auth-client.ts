// Test helper: registers a real account through POST /auth/register and returns an HTTP client
// that sends that account's bearer token. Passwords here exist only inside tests.
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

export const TEST_PASSWORD = 'Correct-horse-battery-1';

export interface AuthedHttp {
  get: (url: string) => request.Test;
  post: (url: string) => request.Test;
  put: (url: string) => request.Test;
  delete: (url: string) => request.Test;
}

export interface TestSession {
  token: string;
  user: { id: string; email: string; name: string };
  /** supertest client that is signed in as this account */
  http: () => AuthedHttp;
}

export async function registerTestUser(app: INestApplication, label = 'user'): Promise<TestSession> {
  const email = `${label}-${randomUUID()}@test.example`;
  const res = await request(app.getHttpServer()).post('/auth/register').send({ name: `Test ${label}`, email, password: TEST_PASSWORD }).expect(201);
  const token = res.body.token as string;
  const withToken = (t: request.Test) => t.set('Authorization', `Bearer ${token}`);
  return {
    token,
    user: res.body.user,
    http: () => {
      const base = () => request(app.getHttpServer());
      return {
        get: (u) => withToken(base().get(u)),
        post: (u) => withToken(base().post(u)),
        put: (u) => withToken(base().put(u)),
        delete: (u) => withToken(base().delete(u)),
      };
    },
  };
}
