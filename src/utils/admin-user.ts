/** Firebase Auth uid allowed to see the Settings admin tab. */
export const ADMIN_UID = 'OjSKut9nGSVTKoBLB4RcjZ8VEgh2'

export function isAdminUser(uid: string | null | undefined) {
  return uid === ADMIN_UID
}
