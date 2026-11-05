export function passwordProblem(password: string, name?: string | null, phone?: string | null, email?: string | null) {
  if (password.length < 10) return "Use at least 10 characters";
  const lower = password.toLowerCase();
  const banned = [name, phone, email, email?.split("@")[0]].filter(Boolean).map((value) => String(value).toLowerCase());
  if (banned.some((value) => value.length >= 4 && lower === value)) return "The password cannot match the name, mobile or username";
  return null;
}
