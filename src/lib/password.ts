// What a password must contain, at sign-up and when the owner creates an
// employee's access: long enough, with an uppercase letter, a lowercase
// letter, a digit and a symbol. "1234" or "boutique" are refused.
//
// Same rule as Supabase's own setting (Authentication > Sign In / Providers
// > Email > "Lowercase, uppercase letters, digits and symbols"), which
// checks unaccented letters and the symbols of an English keyboard only: a
// password with "É" as its only capital, or "€" as its only symbol, would
// pass a looser check here and then be refused by Supabase.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const PASSWORD_RULES = ["length", "upper", "lower", "digit", "special"] as const;
export type PasswordRule = (typeof PASSWORD_RULES)[number];

export function passwordIssues(password: string): PasswordRule[] {
  const issues: PasswordRule[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("length");
  if (!/[A-Z]/.test(password)) issues.push("upper");
  if (!/[a-z]/.test(password)) issues.push("lower");
  if (!/[0-9]/.test(password)) issues.push("digit");
  if (![...password].some((char) => PASSWORD_SYMBOLS.includes(char))) issues.push("special");
  return issues;
}

export function isStrongPassword(password: string): boolean {
  return passwordIssues(password).length === 0;
}
