/** A ticket is re-assigned once a technician was already on it and another is chosen. */
export function becameReassigned(previousEngineerId: string | null | undefined, nextEngineerId: string | null | undefined) {
  return Boolean(previousEngineerId && nextEngineerId);
}
