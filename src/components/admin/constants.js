export const ROLE_OPTIONS = ['Hasič', 'Strojník', 'VD', 'Zástupce VJ', 'VJ', 'Přístup do Administrace', 'Admin'];

export const CERTIFICATION_OPTIONS = [
  'NDT-16', // Nositel dýchací techniky
  'ZZZ-16', // Zdravotník
  'OMP-64', // Obsluha motorových pil
  'Záchrana na vodě',
  'V-40',   // Velitelé družstev
  'S-40' // Strojníci
];

// ======== CATEGORY CONFIGURATION ========
export const CATEGORY_CONFIG = {
  shifts:      { label: 'Směny',       color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)', icon: '📅' },
  activities:  { label: 'Aktivity',    color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)', icon: '🎓' },
  maintenance: { label: 'Údržba',      color: 'var(--warning-dark)', bg: 'var(--warning-border-warm)', border: 'var(--accent-amber-grad-1)', icon: '🔧' },
  cleaning:    { label: 'Úklid',       color: 'var(--teal)', bg: 'var(--teal-bg)', border: 'var(--teal-border)', icon: '🧹' },
  profile:     { label: 'Profil',      color: 'var(--accent-purple)', bg: 'var(--accent-purple-bg)', border: 'var(--accent-purple-border-soft)', icon: '👤' },
  admin:       { label: 'Administrace', color: 'var(--danger-dark)', bg: 'var(--danger-bg)', border: 'var(--danger-border-strong)', icon: '🛡️' },
};

export const ACTION_LABELS = {
  JOINED_SHIFT:              'Přihlášen na směnu',
  LEFT_SHIFT:                'Odhlášen ze směny',
  REMOVED_USER_FROM_SHIFT:   'Odebral uživatele ze směny',
  ADDED_ABSENCE:             'Přidána absence',
  DELETED_ABSENCE:           'Smazána absence',
  JOINED_TRAINING:           'Přihlášen na školení',
  LEFT_TRAINING:             'Odhlášen ze školení',
  JOINED_EVENT:              'Přihlášen na akci',
  LEFT_EVENT:                'Odhlášen z akce',
  UPDATED_PROFILE:           'Aktualizace profilu',
  UPDATED_EQUIPMENT:         'Aktualizace vybavení',
  ADMIN_UPDATED_EQUIPMENT:   'Úprava vybavení člena',
  USER_REGISTERED:           'Registrace do systému',
  ADMIN_APPROVED_USER:       'Schválení registrace',
  ADMIN_REJECTED_USER:       'Zamítnutí registrace',
  ADMIN_DEACTIVATED_USER:    'Deaktivace účtu',
  ADMIN_ACTIVATED_USER:      'Aktivace účtu',
  ADMIN_DELETED_USER:        'Smazání účtu',
  ADMIN_CHANGED_ROLE:        'Změna role',
  ADMIN_CHANGED_CERT:        'Změna kvalifikace',
  ADMIN_ADDED_EQUIPMENT_TYPE:   'Přidán druh vybavení',
  ADMIN_UPDATED_EQUIPMENT_TYPE: 'Upraven druh vybavení',
  ADMIN_REMOVED_EQUIPMENT_TYPE: 'Smazán druh vybavení',
  ADMIN_CREATED_TRAINING:    'Vytvořeno školení',
  ADMIN_UPDATED_TRAINING:    'Upraveno školení',
  ADMIN_DELETED_TRAINING:    'Smazáno školení',
  ADMIN_ADDED_TRAINING:      'Admin přidal člena na školení',
  ADMIN_CREATED_EVENT:       'Vytvořena akce',
  ADMIN_UPDATED_EVENT:       'Upravena akce',
  ADMIN_DELETED_EVENT:       'Smazána akce',
  ADMIN_ADDED_EVENT:         'Admin přidal člena na akci',
  ADMIN_ADDED_DAY_SHIFT:     'Přidána denní služba',
  ADMIN_REMOVED_DAY_SHIFT:   'Zrušena denní služba',
  ADMIN_UPDATED_SHIFT_HOURS: 'Úprava hodin služby',
  ADMIN_ASSIGNED_USER_TO_STAZ: 'Přiřazení na stáž/zálohu',
  ADMIN_REMOVED_USER_FROM_STAZ: 'Odebrání ze stáže/zálohy',
  ADMIN_ADDED_SHIFT:         'Vytvořena stáž/záloha',
  ADMIN_UPDATED_SHIFT:       'Upravena stáž/záloha',
  ADMIN_REMOVED_SHIFT:       'Zrušena stáž/záloha',
  INTERESTED_IN_STAZ:        'Projeven zájem o stáž/zálohu',
  CANCELLED_INTEREST_IN_STAZ: 'Zrušen zájem o stáž/zálohu',
  PUBLISHED_QUIZ:            'Zveřejněn kvíz',
  CLOSED_QUIZ:               'Uzavřen kvíz',
  DELETED_QUIZ:              'Smazán kvíz',
  SUBMITTED_QUIZ:            'Odevzdán kvíz',
  GRADED_QUIZ_ANSWER:        'Vyhodnocena odpověď v kvízu',
  SENT_QUIZ_REMINDER:        'Odeslána připomínka kvízu',
  ADMIN_UPDATED_UNIT_NAME:   'Změna názvu jednotky',
  MAINTENANCE_ADDED:         'Přidán záznam údržby',
  MAINTENANCE_UPDATED:       'Upraven záznam údržby',
  MAINTENANCE_DELETED:       'Smazán záznam údržby',
  CLEANING_ADDED:            'Přidán záznam úklidu',
  CLEANING_UPDATED:          'Upraven záznam úklidu',
  CLEANING_DELETED:          'Smazán záznam úklidu',
  BULLETIN_CREATED:          'Přidán příspěvek na nástěnku',
  BULLETIN_UPDATED:          'Upraven příspěvek na nástěnce',
  BULLETIN_DELETED:          'Smazán příspěvek z nástěnky',
  ADMIN_BACKDATED_SHIFT:     'Zpětné přiřazení ke směně',
  ADMIN_CREATED_USER:        'Vytvoření účtu pro člena',
  ADMIN_IMPORTED_SHIFTS:     'Import historických služeb',
  ADMIN_ADDED_LINK:          'Přidán důležitý odkaz',
  ADMIN_UPDATED_LINK:        'Upraven důležitý odkaz',
  ADMIN_REMOVED_LINK:        'Odstraněn důležitý odkaz',
  ADMIN_REORDERED_LINKS:     'Změněno pořadí odkazů',
  ADMIN_ADDED_LINK_GROUP:    'Přidána skupina odkazů',
  ADMIN_UPDATED_LINK_GROUP:  'Upravena skupina odkazů',
  ADMIN_REMOVED_LINK_GROUP:  'Odstraněna skupina odkazů',
};

export function formatRelativeTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'právě teď';
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} hod`;
  if (diff < 604800) return `před ${Math.floor(diff / 86400)} dny`;
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatAbsoluteTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
