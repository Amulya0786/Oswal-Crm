export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string, name?: string | null, phone?: string | null, email?: string | null) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  const lower = password.toLowerCase();
  const banned = [name, phone, email, email?.split("@")[0]].filter(Boolean).map((value) => String(value).toLowerCase());
  if (banned.some((value) => value.length >= 4 && lower === value)) return "The password cannot match the name, mobile or username";
  return null;
}
