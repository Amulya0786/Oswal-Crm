export function newPasswordError(next: string, sameAsCurrent: boolean) {
  if (!next || next.length < 8) return "Use at least 8 characters";
  if (sameAsCurrent) return "Choose a different password";
  return null;
}
