/**
 * Authentication types for SIEG.AI. Accounts and passwords live in the backend (PostgreSQL);
 * the browser only holds the signed token it was given after a successful sign-in.
 */

import { ApplicantDetails } from '../types';

export interface User {
  id: string;
  name: string;
  email: string;
  /** The applicant this account owns on the backend, if it has started an application. */
  applicantId?: string | null;
}

/** Form defaults remembered in this browser (not credentials, not the applicant's backend data). */
export interface UserApplicationData {
  details: ApplicantDetails;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}
