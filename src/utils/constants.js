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
  if (wear === 4) return { background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D' };
  if (wear === 5) return { background: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A' };
  return { background: '#F5F5F5', color: '#555', border: '1px solid #E0E0E0' };
}

export function getWearRowStyle(wear) {
  if (wear === 4) return { background: '#FFF8E1', borderLeft: '4px solid #FB8C00' };
  if (wear === 5) return { background: '#FFEBEE', borderLeft: '4px solid #D32F2F' };
  return null;
}

export const DAYS_CZ_FULL = [
  'neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'
];

export const LOG_PRESETS_MAINTENANCE = [
  'Mytí CAS-30',
  'Mytí OA Toyota',
  'Mytí DA',
  'Kontrola IDP',
  'Nachystání IDP na plnění',
  'Dovezení IDP z plnění',
  'Přemotání lan a označení objímek na hadice',
  'Přezutí PNEU na letní',
  'Přezutí PNEU na zimní',
  'Nachystání kapesních RDST a matry',
  'Odvoz radiostanic na Lídickou',
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
