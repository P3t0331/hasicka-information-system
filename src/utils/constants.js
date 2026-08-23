export const MONTHS_CZ = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export const MONTHS_CZ_FILTER = [
  { value: 'all', label: 'Všechny měsíce' },
  { value: '01', label: 'Leden' },
  { value: '02', label: 'Únor' },
  { value: '03', label: 'Březen' },
  { value: '04', label: 'Duben' },
  { value: '05', label: 'Květen' },
  { value: '06', label: 'Červen' },
  { value: '07', label: 'Červenec' },
  { value: '08', label: 'Srpen' },
  { value: '09', label: 'Září' },
  { value: '10', label: 'Říjen' },
  { value: '11', label: 'Listopad' },
  { value: '12', label: 'Prosinec' }
];

export const WEAR_OPTIONS = [
  { value: 1, label: '1 – Nové' },
  { value: 2, label: '2 – Velmi dobré' },
  { value: 3, label: '3 – Použitelné' },
  { value: 4, label: '4 – Opotřebené' },
  { value: 5, label: '5 – K výměně' }
];

export function getWearStyle(wear) {
  if (wear === 4) return { background: 'var(--warning-bg)', color: 'var(--warning-text-strong)', border: '1px solid var(--warning-border)' };
  if (wear === 5) return { background: 'var(--danger-bg)', color: 'var(--danger-dark)', border: '1px solid var(--danger-border-strong)' };
  return { background: 'var(--surface-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border)' };
}

export function getWearRowStyle(wear) {
  if (wear === 4) return { background: 'var(--warning-bg-soft)', borderLeft: '4px solid var(--warning-bright)' };
  if (wear === 5) return { background: 'var(--danger-bg)', borderLeft: '4px solid var(--danger)' };
  return null;
}

export const DAYS_CZ_FULL = [
  'neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'
];

// Rychlá volba v deníku údržby/úklidu záměrně obsahuje jen základní, opakované
// úkony. Složitější činnosti si každý popíše vlastními slovy a do seznamu se
// nepřidávají.
export const LOG_PRESETS_MAINTENANCE = [
  'Mytí CAS-30',
  'Mytí OA Toyota',
  'Mytí DA',
  'Kontrola IDP',
  'Údržba motorové stříkačky',
  'Drobná oprava techniky'
];

export const LOG_PRESETS_CLEANING = [
  'Vysátí a vytření podlah v obytné části',
  'Desinfekce dřezu, umyvadel, sprchy a WC',
  'Úklid garáže',
  'Úklid kuchyňky',
  'Úklid šaten',
  'Mytí oken',
  'Vynesení odpadků',
  'Úklid dílny'
];
