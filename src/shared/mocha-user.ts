/**
 * Mirrors `@getmocha/users-service/shared` so worker TS can resolve `MochaUser`
 * without relying on package subpath exports in the worker project graph.
 */
export interface MochaUser {
  id: string;
  email: string;
  google_sub: string;
  google_user_data: {
    email: string;
    email_verified: boolean;
    family_name?: string | null;
    given_name?: string | null;
    hd?: string | null;
    name?: string | null;
    picture?: string | null;
    sub: string;
  };
  last_signed_in_at: string;
  created_at: string;
  updated_at: string;
}
