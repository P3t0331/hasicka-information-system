export const DAYS_CZ = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
export const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

export const SLOT_TYPES = ['velitel', 'strojnik', 'hasic1', 'hasic2', 'hasic3', 'hasic4', 'hasic5'];

export const SLOT_LABELS = {
  velitel: 'Velitel',
  strojnik: 'Strojník',
  hasic1: 'Hasič 1',
  hasic2: 'Hasič 2',
  hasic3: 'Hasič 3',
  hasic4: 'Hasič 4',
  hasic5: 'Hasič 5',
};

export const SLOT_ICONS = {
  'velitel': '⭐',
  'strojnik': '🚒',
  'hasic-1': '🧯',
  'hasic-2': '🧯',
  'hasic-3': '🧯',
  'hasic-4': '🧯',
  'hasic1': '🧯',
  'hasic2': '🧯',
  'hasic3': '🧯',
  'hasic4': '🧯',
  'hasic5': '🧯',
};

export const formatDateCZ = (isoDate) => {
  if (!isoDate) return '';
  const [, month, day] = isoDate.split('-');
  return `${parseInt(day)}.${parseInt(month)}.`;
};

export const getSlotLabel = (slotKey) => {
  if (SLOT_LABELS[slotKey]) return SLOT_LABELS[slotKey];
  if (slotKey.startsWith('velitel')) return 'Velitel ' + slotKey.replace('velitel', '');
  if (slotKey.startsWith('strojnik')) return 'Strojník ' + slotKey.replace('strojnik', '');
  if (slotKey.startsWith('hasic')) return 'Hasič ' + slotKey.replace('hasic', '');
  return slotKey;
};

// A Záloha/Stáž is one of two kinds. Records created before the kind was tracked
// have no `kind` at all and count as 'zaloha' — the unit has had no stáž yet, so
// this makes every historical record read as Záloha without touching stored data.
// accusative = "Vytvořil zálohu", genitive = "ze zálohy" — logs and notifications
// need the declined forms, not just the label.
export const ZALOHA_KINDS = [
  { value: 'zaloha', label: 'Záloha', icon: '🛡️', accusative: 'zálohu', genitive: 'zálohy' },
  { value: 'staz', label: 'Stáž', icon: '🎓', accusative: 'stáž', genitive: 'stáže' },
];

export const getZalohaKind = (config) => (config?.kind === 'staz' ? 'staz' : 'zaloha');

export const getZalohaKindForms = (config) =>
  ZALOHA_KINDS.find(k => k.value === getZalohaKind(config));

export const getZalohaKindLabel = (config) => getZalohaKindForms(config).label;

// Slot keys a Záloha/Stáž shows for a given config. Shared by the calendar row
// and the edit flow so both agree on which slots exist for a config.
export const getZalohaSlots = (config) => {
  const { velitelCount = 1, strojnikCount = 1, hasicCount = 2 } = config || {};
  const slots = [];
  for (let i = 1; i <= velitelCount; i++) slots.push(i === 1 ? 'velitel' : `velitel${i}`);
  for (let i = 1; i <= strojnikCount; i++) slots.push(i === 1 ? 'strojnik' : `strojnik${i}`);
  for (let i = 1; i <= hasicCount; i++) slots.push(`hasic${i}`);
  return slots;
};

// Assigned slots of a Záloha/Stáž (skips the config and interested metadata keys).
export const getZalohaAssignedSlots = (sectionData) =>
  Object.entries(sectionData || {})
    .filter(([key, value]) => key !== 'config' && key !== 'interested' && value?.uid);

export const getSlotBaseType = (slotKey) => {
  if (slotKey.startsWith('velitel')) return 'velitel';
  if (slotKey.startsWith('strojnik')) return 'strojnik';
  if (slotKey.startsWith('hasic')) return 'hasic';
  return slotKey;
};
