import { MIN_PASSWORD_LENGTH } from "./password";

export function newPasswordError(next: string, sameAsCurrent: boolean) {
  if (!next || next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (sameAsCurrent) return "Choose a different password";
  return null;
}
