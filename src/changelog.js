// Bump APP_VERSION and add an entry here only when explicitly told to release.
// Entries must be sorted newest-first. The modal shows all entries
// newer than what the user last saw.
//
// Each entry supports either a flat `changes` array (simple) or `sections` (categorized).
// Section format: [{ label: 'Nové funkce', changes: [...] }, ...]
// Available section labels: 'Nové funkce', 'Opravy chyb', 'Vylepšení', 'Změny'
export const APP_VERSION = '1.2.0';

export const CHANGELOG = [
  {
    version: '1.2.0',
    date: '24. 8. 2026',
    sections: [
      {
        label: 'Nové funkce',
        changes: [
          'V profilu přibyla záložka Nastavení — světlé nebo tmavé téma (i podle systému), výchozí úvodní stránka po přihlášení, výběr a pořadí widgetů na dashboardu a zapínání jednotlivých typů push notifikací (kvízy, služby, školení, akce).',
        ],
      },
      {
        label: 'Opravy chyb',
        changes: [
          'Přesměrování na výchozí úvodní stránku se nyní uplatní jen jednou po přihlášení, ne při každé návštěvě dashboardu.',
          'Ukládání nastavení nyní hlásí chybu, pokud se nepodaří — dřív se změna beze zprávy vrátila zpět.',
        ],
      },
    ],
  },
  {
    version: '1.1.2',
    date: '21. 8. 2026',
    sections: [
      {
        label: 'Opravy chyb',
        changes: [
          'Přihlášení na noční službu v měsíci, kde ještě nebyla vytvořena žádná denní služba, nyní funguje správně — dříve končilo chybou „Chyba při ukládání služby".',
          'Opakované klepnutí na „Přihlásit" u školení nebo akce už člena nepřidá vícekrát — přihlášení se nově ukládá bezpečně a nemůže vzniknout duplicitní účast.',
        ],
      },
    ],
  },
  {
    version: '1.1.1',
    date: '19. 8. 2026',
    sections: [
      {
        label: 'Vylepšení',
        changes: [
          'Ve Školení se nově zobrazují jen kvízy, které ještě čekají na vyplnění. Splněné a uzavřené najdete ve svém profilu.',
          'V profilu si u každého absolvovaného kvízu můžete přes „Zobrazit" prohlédnout své odpovědi.',
        ],
      },
      {
        label: 'Opravy chyb',
        changes: [
          'Rozbor odpovědí zůstává dostupný i po odchodu ze stránky s výsledkem — dřív se dal zobrazit jen jednou, hned po odeslání.',
          'Tiskový protokol už nepřetéká na druhou stranu kvůli podpisovému poli.',
          'Logy v administraci ukazují u kvízů české popisky místo interních kódů.',
        ],
      },
      {
        label: 'Změny',
        changes: [
          'Administrátor může smazat i zveřejněný nebo uzavřený kvíz. Potvrzení předem řekne, kolik odevzdaných pokusů se tím nenávratně ztratí.',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date: '19. 8. 2026',
    sections: [
      {
        label: 'Nové funkce',
        changes: [
          'Kvízy — velitelé mohou zadat povinný test ke školení s termínem a hranicí úspěšnosti.',
          'Kvíz vyplníte na stránce Školení, rozpracované odpovědi se průběžně ukládají.',
          'Nesplněné kvízy se připomínají na hlavní stránce i notifikací před termínem.',
          'Historii absolvovaných kvízů najdete ve svém profilu.',
          'Administrace nabízí přehled výsledků, statistiku otázek a tiskový protokol o absolvování školení.',
        ],
      },
    ],
  },
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
