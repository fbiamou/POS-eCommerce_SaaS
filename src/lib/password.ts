// What a password must contain, at sign-up and when the owner creates an
// employee's access: long enough, with an uppercase letter, a lowercase
// letter, a digit and a special character. "1234" or "boutique" are refused.
// The same rule should be set in Supabase (Authentication > Providers >
// Email > password requirements), which enforces it on its side too.

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = ["length", "upper", "lower", "digit", "special"] as const;
export type PasswordRule = (typeof PASSWORD_RULES)[number];

export function passwordIssues(password: string): PasswordRule[] {
  const issues: PasswordRule[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("length");
  if (!/\p{Lu}/u.test(password)) issues.push("upper");
  if (!/\p{Ll}/u.test(password)) issues.push("lower");
  if (!/\p{N}/u.test(password)) issues.push("digit");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) issues.push("special");
  return issues;
}

export function isStrongPassword(password: string): boolean {
  return passwordIssues(password).length === 0;
}
