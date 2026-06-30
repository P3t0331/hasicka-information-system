// Bump APP_VERSION and add an entry here only when explicitly told to release.
// Entries must be sorted newest-first. The modal shows all entries
// newer than what the user last saw.
//
// Each entry supports either a flat `changes` array (simple) or `sections` (categorized).
// Section format: [{ label: 'Nové funkce', changes: [...] }, ...]
// Available section labels: 'Nové funkce', 'Opravy chyb', 'Vylepšení', 'Změny'
export const APP_VERSION = '1.0.1';

export const CHANGELOG = [
  {
    version: '1.0.1',
    date: '30. 6. 2026',
    sections: [
      {
        label: 'Nové funkce',
        changes: [
          'Přidán přehled změn po každé aktualizaci aplikace, změny jsou rozděleny do kategorií',
          'Členové: přidáno řazení podle jména nebo evidenčního čísla',
          'Návrhy: členové mohou podávat návrhy přes odkaz v patičce a hlasovat pro ně nebo proti nim; admini mohou spravovat stav a přidávat poznámky',
        ],
      },
      {
        label: 'Vylepšení',
        changes: [
          'Role Zástupce VJ lze nyní přiřadit více členům najednou',
          'Statistiky – hodiny: Celkem nyní zahrnuje vše (stáže, zálohy, SMS). Přidány přehledy Služby na hasičce a Z toho doma (SMS)',
        ],
      },
      {
        label: 'Opravy chyb',
        changes: [
          'Přihlášení na směnu jednoho uživatele již nemůže přepsat přihlášení jiného při pomalém připojení nebo starých datech v cache',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '1. 6. 2026',
    changes: [
      'Počáteční vydání',
    ],
  },
];
