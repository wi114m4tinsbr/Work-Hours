export const OWNER_EMAIL = 'martinswilliam2004@gmail.com';

export type PlanType = 'free' | 'monthly';
export type AccountStatus = 'active' | 'blocked' | 'banned';

type TimestampLike = { toMillis: () => number } | null | undefined;

export interface Subscription {
  type?: PlanType;
  expiryDate?: TimestampLike;
  grantedBy?: string;
  grantedAt?: TimestampLike;
}

/** Premium counts only while it has no expiry or the expiry is still ahead. */
export function isPremium(subscription: Subscription | undefined, now = Date.now()): boolean {
  if (subscription?.type !== 'monthly') return false;
  const expiry = subscription.expiryDate;
  return !expiry || expiry.toMillis() > now;
}

export function accountStatus(data: { status?: unknown } | undefined): AccountStatus {
  return data?.status === 'blocked' || data?.status === 'banned' ? data.status : 'active';
}
