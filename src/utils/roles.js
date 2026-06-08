const ELEVATED_ROLES = ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'];

export function getEffectiveRoles(storedRoles) {
  const roles = storedRoles || [];
  if (roles.some(r => ELEVATED_ROLES.includes(r)) && !roles.includes('Přístup do Administrace')) {
    return [...roles, 'Přístup do Administrace'];
  }
  return roles;
}
