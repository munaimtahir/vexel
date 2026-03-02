export interface ImpersonationCookiePayload {
  session_id: string;
  impersonated_user_id: string;
  mode: 'READ_ONLY';
  exp: number;
}

export interface ImpersonationContext {
  sessionId: string;
  mode: 'READ_ONLY';
  startedById: string;
  expiresAt: Date;
}
