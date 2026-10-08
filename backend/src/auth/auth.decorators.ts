import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global authentication guard. Everything else requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The authenticated account, as loaded from the database by the authentication guard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** The caller's identity comes from the verified token, never from the request body or URL. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
