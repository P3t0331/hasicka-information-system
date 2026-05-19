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

export const getSlotBaseType = (slotKey) => {
  if (slotKey.startsWith('velitel')) return 'velitel';
  if (slotKey.startsWith('strojnik')) return 'strojnik';
  if (slotKey.startsWith('hasic')) return 'hasic';
  return slotKey;
};
