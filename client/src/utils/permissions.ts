import { UserRole } from '../types';

export type EffectiveRole = 'super_admin' | 'руководитель' | 'информационный' | 'туризм';

const LEGACY: Partial<Record<UserRole, EffectiveRole>> = {
  smm: 'информационный',
  редактор: 'информационный',
  документовед: 'туризм',
  мол: 'туризм',
};

export function effectiveRoles(user: { role?: string; roles?: string[] } | null | undefined): EffectiveRole[] {
  if (!user) return [];
  const raw: string[] = (user.roles?.length ? user.roles : [user.role].filter(Boolean)) as string[];
  const set = new Set<EffectiveRole>();
  for (const r of raw) {
    const er = LEGACY[r as UserRole] || (r as EffectiveRole);
    if (er) set.add(er);
    if (r === 'super_admin' || r === 'руководитель' || r === 'информационный' || r === 'туризм') {
      set.add(r as EffectiveRole);
    }
  }
  return [...set];
}

export function isManager(user: any): boolean {
  const rs = effectiveRoles(user);
  return rs.includes('super_admin') || rs.includes('руководитель');
}

export function isAdmin(user: any): boolean {
  return effectiveRoles(user).includes('super_admin');
}

/** Content plan write — туризм is read-only */
export function canWriteContent(user: any): boolean {
  const rs = effectiveRoles(user);
  return rs.includes('super_admin') || rs.includes('руководитель') || rs.includes('информационный');
}

/** Own-record only (not manager) */
export function isLimitedEditor(user: any): boolean {
  return !isManager(user);
}

/** Can edit specific record if manager or owner */
export function canEditRecord(user: any, ownerId?: string | null): boolean {
  if (isManager(user)) return true;
  return !!user?.id && ownerId === user.id;
}
