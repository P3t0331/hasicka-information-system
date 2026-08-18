// Bump APP_VERSION and add an entry here only when explicitly told to release.
// Entries must be sorted newest-first. The modal shows all entries
// newer than what the user last saw.
//
// Each entry supports either a flat `changes` array (simple) or `sections` (categorized).
// Section format: [{ label: 'Nové funkce', changes: [...] }, ...]
// Available section labels: 'Nové funkce', 'Opravy chyb', 'Vylepšení', 'Změny'
export const APP_VERSION = '1.0.3';

export const CHANGELOG = [
  {
    version: '1.0.3',
    date: '18. 8. 2026',
    sections: [
      {
        label: 'Nové funkce',
        changes: [
          'Školení lze označit jako důležité – stejně jako u akcí se zvýrazní oranžově a dostane odznak ⚠️ Důležité',
          'Odkazy v nástěnce jsou nyní klikatelné, včetně adres psaných bez http:// (např. www.hasici.cz)',
        ],
      },
      {
        label: 'Vylepšení',
        changes: [
          'Statistiky: noční služby jsou nyní černé stejně jako v záložce Služby – už se nepletou se zálohami',
          'Menu: záložka SLUŽBY je zvýrazněná červeně, aby byla na první pohled k nalezení',
        ],
      },
    ],
  },
  {
    version: '1.0.2',
    date: '26. 7. 2026',
    sections: [
      {
        label: 'Nové funkce',
        changes: [
          'Zálohu/stáž lze nyní upravit i po vytvoření – změna času i počtu pozic (např. ze 4 na 5 hasičů) přes tlačítko Upravit',
          'Při vytváření se vybírá, zda jde o Zálohu nebo Stáž; typ je vidět u každé služby a lze ho i zpětně změnit přes Upravit',
        ],
      },
      {
        label: 'Vylepšení',
        changes: [
          'Vybavení lze nyní řadit podle evidenčního čísla – v profilu u přiděleného vybavení i v administraci v detailním inventáři',
        ],
      },
      {
        label: 'Změny',
        changes: [
          'Při snížení počtu pozic u zálohy/stáže se zobrazí, kdo bude z pozice odebrán; odebraní členové zůstávají v seznamu zájemců a dostanou upozornění',
          'Při změně času zálohy/stáže dostanou přiřazení členové upozornění',
          'Všechny dříve vypsané služby se zobrazují jako Záloha – pokud některá byla stáž, přepněte jí typ přes Upravit',
          'Údržba a úklid: rychlá volba činnosti nabízí jen základní úkony – ručně psané popisy se do ní už nepřidávají',
        ],
      },
    ],
  },
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
