/** A profile marked hidden stays in Firestore but is left off participant lists. */
export function isHiddenUser(user: object | null | undefined): boolean {
  if (!user || !('hidden' in user)) return false
  return (user as { hidden?: unknown }).hidden === true
}
