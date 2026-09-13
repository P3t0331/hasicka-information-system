# Dostupnost – posádka k dopravním nehodám — návrh funkcionality

**Datum:** 13. 9. 2026
**Stav:** návrh odsouhlasen, čeká na implementační plán

---

## 1. Účel

Jednotka získává kvalifikaci VDN-40 (vyprošťování u dopravních nehod). K výjezdu na DN je potřeba mít v kterýkoliv den k dispozici posádku **2× Hasič, 1× Strojník, 1× Velitel (VD / Zástupce VJ / VJ)**. Dnes není kde zjistit, které dny posádka chybí a koho konkrétně shánět.

Členové si v aplikaci co nejjednodušeji označí, kdy jsou k dispozici (a za jak dlouho dorazí na stanici). Aplikace z toho spočítá, zda je pro daný den posádka kompletní, a ukáže to všem hned po otevření dashboardu. Statistiky pak ukazují, které pozice chybí nejčastěji.

**Rozsah:** karta na dashboardu, nová kolekce `availability`, sdílená výpočetní logika v `shared/`, záznamy do logů, nová záložka ve Statistikách.

**Mimo rozsah (vyřazeno při návrhu):** push notifikace o chybějící posádce, opakující se týdenní vzor, VDN-40 jako podmínka započtení, úprava cizí dostupnosti adminem, historie rolí.

---

## 2. Rozhodnutí a jejich důvody

| Rozhodnutí | Zvolená varianta | Důvod |
|---|---|---|
| Časová granularita | Výchozí celý den 05:00–18:00 jedním klepnutím, volitelně vlastní časy | Maximální jednoduchost; noc pokrývají noční služby |
| Více časů za den | Až 3 časové úseky na den (např. 05–10, 13–18) | Reálné rozdělení dne (práce/domov); limit 3 kvůli ověření ve Firestore rules (bez cyklů) |
| Způsob zadávání | Konkrétní data v okně 14 dní + tlačítko „Opakovat na další týden" | Týdny se liší; trvalý vzor by tiše „vyplňoval" dny, na které lidé zapomněli, a falešně hlásil posádku |
| Viditelnost | Všichni členové vidí stav i jména | Člen může mezeru zaplnit sám bez obvolávání |
| Započtení | Podle rolí, VDN-40 se nevyžaduje | Kvalifikaci zatím má málo lidí; všechny dny by jinak byly červené |
| Více rolí u jednoho člověka | Každý obsadí nejvýše jednu pozici, přiřazení se optimalizuje | Realita výjezdu — jeden člověk nemůže být velitel i strojník |
| Absence | Absence v daný den blokuje dostupnost | Konzistence s existující evidencí absencí |
| Denní služba | Člen na denní službě se počítá automaticky | Je fyzicky na stanici, nemá smysl ho nutit klikat |
| Notifikace | Žádné v první verzi | Nejdřív ověřit, že se funkce používá; nepřidávat únavu z notifikací |
| Datový model | Jeden dokument na člověka a den (`availability/{datum}_{uid}`) | Jednoduchá pravidla (zapisuješ jen své), žádné souběžné přepisy sdíleného dokumentu |
| Dojezd na stanici | Samostatně pro každý časový úsek, jen informativní | V práci je člověk dál než doma; pevný limit by uměle „vyřazoval" lidi |
| Umístění | Pevná karta pod pozdravem na dashboardu, mimo přeuspořádatelné widgety | Požadavek: vidět hned po otevření aplikace |
| Logování | Každé přidání/úprava/zrušení + jeden souhrnný záznam při kopírování týdne | Dohledatelnost; kopírování by jinak zahltilo logy |
| Statistiky | Nová záložka „Dostupnost" ve Statistikách, stejná výpočetní funkce jako dashboard | Dashboard a statistiky se nesmí rozcházet (poučení z rozdílu „Hodin (Běžné)") |

---

## 3. Dashboard — karta „Dostupnost – posádka k DN"

### 3.1 Umístění

Pevná karta hned pod hlavičkou s pozdravem, **nad** `WeatherWarnings` a bannery. Není součástí `DEFAULT_DASHBOARD_WIDGET_ORDER`, nejde skrýt ani přesunout. Členové, kteří mají v Nastavení jinou úvodní stránku, ji uvidí až po přechodu na dashboard (vědomá volba uživatele).

### 3.2 Hlavička

- Nadpis: **Dostupnost – posádka k DN**
- Podtitul: `2× Hasič · 1× Strojník · 1× Velitel`

### 3.3 Pás dnů

14 dlaždic (dnes + 13 dní), na mobilu vodorovně posuvné. Každá dlaždice:

- den v týdnu a datum (`Po 15.`),
- barva stavu 🟢 / 🟡 / 🔴 a počet obsazených pozic `3/4` (z nejlepšího segmentu, viz 5.3),
- zvýrazněný rámeček, pokud jsem v ten den dostupný **já**,
- šedě, pokud mám v ten den absenci.

Výchozí vybraný den je dnešek.

### 3.4 Panel vybraného dne

Pod pásem:

1. **Stav:** `🟢 Kompletní` / `🟡 Kompletní jen 05:00–09:00, 13:00–18:00` / `🔴 Chybí: Strojník, 1× Hasič`.
2. **Moje dostupnost:**
   - Nejsem označen → velké tlačítko **„Jsem k dispozici (05:00–18:00)"**. Uloží celý den s mým zapamatovaným dojezdem (viz 3.6).
   - Jsem označen → **„✓ Jsem k dispozici"** s mými úseky (např. `05–10 (15 min), 13–18 (2 min)`) a volbami **Změnit čas** a **Zrušit**.
   - Mám absenci → místo tlačítka text „Máš absenci" (bez akce).
   - Jsem na denní službě → „Jsi na denní službě" (bez akce; spravuje se ve Službách). Pokud mám zároveň ruční záznam, zobrazí se i s volbami Změnit čas / Zrušit.
3. **Kdo je k dispozici:** seznam jmen, u každého:
   - nejvyšší role (Velitel > Strojník > Hasič),
   - časy, pokud nejde o celý den 05:00–18:00,
   - dojezd `🕒 5 min`; u více úseků `05–10 (15 min), 13–18 (2 min)`,
   - lidé z denní služby se štítkem **„denní služba"** a místo dojezdu **„na stanici"**.

Minulé dny se nedají vybrat k úpravě (pás začíná dneškem).

### 3.5 Úprava času („Změnit čas")

- Řádek na úsek: **od – do – dojezd**. Dojezd jako výběr z `1 · 2 · 5 · 10 · 15 · 20 · 30 min` + **Jiný** (číselné pole, celé minuty 1–180).
- Tlačítko 🗑 u řádku, **„+ Přidat další čas"** (skryto při 3 úsecích), **Uložit**.
- Smazání posledního úseku = Zrušit.
- Validace (tlačítko Uložit je neaktivní + krátká nápověda):
  - `od` < `do`, obojí v rozsahu 05:00–18:00,
  - dojezd 1–180,
  - úseky, které se překrývají a mají **různý** dojezd → „Časy se překrývají".
- Před uložením se úseky seřadí a úseky, které se překrývají nebo dotýkají a mají **stejný** dojezd, se sloučí (5–10 + 9–12, obojí 5 min → 5–12). Dotýkající se úseky s různým dojezdem (5–10 za 15 min, 10–18 za 2 min) zůstanou oddělené.

### 3.6 Zapamatovaný dojezd

- Uložen v `users/{uid}.preferences.availabilityTravelMin`.
- Při každém uložení dostupnosti se nastaví na dojezd posledního ukládaného úseku, pokud se liší.
- **První použití** (hodnota neexistuje): klepnutí na „Jsem k dispozici" otevře malý dotaz „Za jak dlouho jsi na stanici?" s volbami 1/2/5/10/15/20/30 min + Jiný. Po výběru se záznam uloží a hodnota zapamatuje.

### 3.7 „Opakovat na další týden"

Tlačítko pod pásem. Zkopíruje **moje** ruční záznamy ze dnů 1–7 pásu (dnes až dnes+6) na odpovídající dny 8–14 (+7 dní):

- nepřepíše den, kde už mám záznam,
- přeskočí den, kde mám absenci,
- záznamy ze služeb se nekopírují (jen dokumenty `availability`),
- nic ke zkopírování → info toast „Není co kopírovat", bez logu,
- jinak toast „Zkopírováno na N dní" a jeden souhrnný log (viz 7).

Zkopírované záznamy jsou běžné záznamy — upravují se a ruší jako jakékoliv jiné.

### 3.8 Načítání a chyby

- Při načítání šedé zástupné dlaždice.
- Zápis se v UI projeví okamžitě; při selhání se vrátí zpět a zobrazí se chybový toast „Chyba při ukládání dostupnosti".
- Offline: zobrazí se poslední známá data z cache Firestore, uložení bez připojení skončí chybovým toastem.
- „Dnes" = místní datum zařízení; pás se posune při dalším vykreslení po půlnoci.

---

## 4. Data a zabezpečení

### 4.1 Kolekce `availability`

- **ID dokumentu:** `{YYYY-MM-DD}_{uid}` (např. `2026-09-15_abc123`) — deterministické, žádné duplicity.
- **Pole:**

```js
{
  uid: 'abc123',
  date: '2026-09-15',
  slots: [
    { from: '05:00', to: '10:00', travelMin: 15 },
    { from: '13:00', to: '18:00', travelMin: 2 },
  ],
  updatedAt: serverTimestamp(),
}
```

- **Uložení / změna:** `setDoc` (přepis celého dokumentu). **Zrušení:** `deleteDoc`.
- Staré dokumenty se nemažou (slouží statistikám).

### 4.2 Firestore rules

**Důležité:** `firestore.rules` obsahuje zástupné pravidlo `match /{collection}/{document=**}`, které povoluje čtení i zápis všem přihlášeným pro každou kolekci kromě vyjmenovaných výjimek. Pravidla ve Firestore se sčítají (stačí jedno povolující), takže do této podmínky je nutné přidat `&& collection != 'availability'` — jinak by níže uvedená pravidla neměla žádný účinek.

```
match /availability/{docId} {
  allow read: if isSignedIn();
  allow create, update: if isSignedIn()
    && request.resource.data.uid == request.auth.uid
    && docId == request.resource.data.date + '_' + request.auth.uid
    && request.resource.data.slots is list
    && request.resource.data.slots.size() >= 1
    && request.resource.data.slots.size() <= 3
    && validSlot(request.resource.data.slots[0])
    && (request.resource.data.slots.size() < 2 || validSlot(request.resource.data.slots[1]))
    && (request.resource.data.slots.size() < 3 || validSlot(request.resource.data.slots[2]));
  allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
}

function validSlot(s) {
  return s.from is string && s.to is string
    && s.from.matches('^[0-2][0-9]:[0-5][0-9]$') && s.to.matches('^[0-2][0-9]:[0-5][0-9]$')
    && s.from >= '05:00' && s.from < s.to && s.to <= '18:00'
    && s.travelMin is int && s.travelMin >= 1 && s.travelMin <= 180;
}
```

Čtení odpovídá zbytku aplikace (`isSignedIn()`; schválení členů hlídá aplikace, rules to dnes u jiných kolekcí nerozlišují). Validace slotů je rozepsaná pro indexy 0, 1, 2, protože rules nemají cykly. Formát `HH:MM` s nulou na začátku umožňuje porovnání řetězců.

Nikdo (ani Admin) nemůže měnit cizí dostupnost. Zákaz úprav minulých dnů je vynucen jen v UI (rules neumí pohodlně porovnat řetězec data s dneškem).

Zápis `users/{uid}.preferences.availabilityTravelMin` pokrývá stávající zástupné pravidlo (stejně jako ostatní preference z Nastavení) — beze změny.

### 4.3 Načítání na dashboardu

- `onSnapshot` na `availability` s `where('date', '>=', dnes)` a `where('date', '<=', dnes+13)` — živé aktualizace pro všechny.
- Absence: existující `absences`, které se překrývají s oknem 14 dní (všichni členové).
- Denní služby: měsíční dokumenty `shifts` pro 1–2 měsíce, do kterých okno zasahuje; z nich `days[d].dayShift`.
- Členové a role: existující načtený seznam uživatelů (pouze `approved` a ne `disabled`).

---

## 5. Výpočet posádky — `shared/availability.js`

Čistá logika bez Firebase, sdílená dashboardem i statistikami, testovaná Vitestem.

### 5.1 Pozice a role

| Pozice | Počet | Kdo ji může obsadit |
|---|---|---|
| Velitel | 1 | VD, Zástupce VJ (i varianta `Zastupce VJ`), VJ |
| Strojník | 1 | Strojník |
| Hasič | 2 | Hasič, Strojník, VD, Zástupce VJ, VJ |

`Admin` a `Přístup do Administrace` nejsou hasičské role — samy o sobě se nepočítají.

### 5.2 Vstup pro jeden den

Pro každého člena seznam intervalů v rámci 05:00–18:00:

- ruční úseky z dokumentu `availability` (s `travelMin`),
- denní služba: interval `timeFrom`–`timeTo` ze slotu, pokud je vyplněn, jinak 05:00–18:00; ořízne se na 05:00–18:00; `source: 'dayShift'`, bez dojezdu,
- intervaly jednoho člověka se pro účely obsazení sjednotí,
- člen s absencí v daný den (`startDate <= datum <= endDate`) se vyřadí celý,
- neschválení a deaktivovaní členové se ignorují.

### 5.3 Algoritmus

1. Časové hranice = 05:00, 18:00 a všechny začátky/konce intervalů → segmenty.
2. Pro každý segment množina přítomných lidí → maximální obsazení 4 pozic (bipartitní párování; malý počet lidí, stačí jednoduché augmentující cesty). Výsledek: počet obsazených (0–4) a chybějící pozice.
3. Stav dne:
   - 🟢 `complete` — všechny segmenty 4/4,
   - 🟡 `partial` — aspoň jeden segment 4/4; sousední kompletní segmenty se spojí do rozsahů (`[{from, to}]`),
   - 🔴 `missing` — žádný segment 4/4.
4. **Nejlepší segment** = nejvíce obsazených pozic, při shodě nejdelší (při další shodě nejdřívější). Z něj pochází `filled` (např. 3) a `missing` (např. `['Strojník']` nebo `['Hasič', 'Hasič']`, zobrazeno jako `1× Hasič` / `2× Hasič`).

### 5.4 Rozhraní (orientační)

```js
export const CREW_REQUIREMENT;              // definice pozic z 5.1
export function normalizeSlots(slots);      // seřazení + sloučení stejných dojezdů; vrací { slots, error }
export function validateSlots(slots);       // chyby pro UI (čas, rozsah, dojezd, překryv)
export function getPrimaryRole(roles);      // 'Velitel' | 'Strojník' | 'Hasič' | null
export function computeDayCoverage({ date, members, availabilityDocs, absences, dayShift });
// → { status, filled, missing, completeRanges, people: [{ uid, name, primaryRole, slots, source }] }
export function summarizeMonth({ days, members, availabilityDocs, absences, shiftsByDate, today });
// → { counts: { complete, partial, missing }, missingByPosition, memberHours: [{ uid, name, hours, avgTravelMin }], perDay }
```

---

## 6. Statistiky — záložka „🚑 Dostupnost"

Nová záložka ve `StatisticsPage` vedle Absencí, používá stávající přepínač měsíce. Komponenta `src/components/statistics/AvailabilityTab.jsx`.

**Hodnocené dny:** od 1. dne měsíce do **dneška** včetně (budoucnost patří dashboardu); u minulých měsíců celý měsíc.

**Obsah:**

1. **Tři `StatCard`:** počet dní 🟢 Kompletní / 🟡 Částečně / 🔴 Chybí.
2. **Přehled měsíce:** mřížka kalendáře, dny obarvené stavem. Klepnutí na den zobrazí stejné detaily jako panel dashboardu (stav, co chybělo, kdo byl k dispozici) — jen pro čtení.
3. **„Nejčastěji chybí"** (`ChartBlock` + Recharts BarChart): pro Velitel / Strojník / Hasič počet dní, kdy pozice chyběla v nejlepším segmentu dne.
4. **„Dostupnost členů"**: sloupec za člena = **hodiny k dispozici** v měsíci (ruční úseky + denní služba, bez dnů s absencí), seřazeno sestupně, členové s 0 h skryti. Tooltip navíc ukazuje **průměrný dojezd** vážený hodinami (jen ruční úseky; denní služba se nezapočítává).

**Data:** jeden rozsahový dotaz na `availability` pro měsíc; směny, absence a členy už stránka načítá. Výpočet přes `summarizeMonth`.

**Známé omezení:** role se neukládají historicky — minulé měsíce se počítají s aktuálními rolemi členů.

---

## 7. Logy

Přes stávající `logAction(db, uid, userName, action, category, detail)`, fire-and-forget.

**Nová kategorie** v `CATEGORY_CONFIG` (`src/components/admin/constants.js`):

```js
availability: { label: 'Dostupnost', color: 'var(--indigo-deep)', bg: 'var(--indigo-bg)', border: 'var(--indigo)', icon: '🚑' },
```

Indigo odstín se u ostatních kategorií nepoužívá. Při implementaci ověřit, že tokeny `--indigo*` mají hodnoty i v tmavém tématu; pokud ne, doplnit je. Filtrační chip v Logy se objeví automaticky.

**Nové akce** v `ACTION_LABELS`:

| Akce | Popisek | Příklad detailu |
|---|---|---|
| `AVAILABILITY_ADDED` | Přidána dostupnost | `Označil se jako dostupný na 15. 9. 2026 (05:00–18:00, dojezd 5 min)` |
| `AVAILABILITY_UPDATED` | Upravena dostupnost | `Změnil dostupnost na 15. 9. 2026: 05:00–10:00 (dojezd 15 min), 13:00–18:00 (dojezd 2 min) (dříve 05:00–18:00, dojezd 5 min)` |
| `AVAILABILITY_REMOVED` | Zrušena dostupnost | `Zrušil dostupnost na 15. 9. 2026 (bylo 05:00–10:00, 13:00–18:00)` |
| `AVAILABILITY_COPIED_WEEK` | Dostupnost zkopírována na další týden | `Zkopíroval dostupnost na další týden: 22. 9., 23. 9., 27. 9. 2026 (3 dny)` |

- Změna pouze dojezdu = `AVAILABILITY_UPDATED`.
- Kopírování týdne = jeden souhrnný záznam; bez zkopírovaných dnů žádný záznam.
- Kategorie všech akcí: `availability`.
- Denní služby se zde nelogují (logují je Služby).
- Skloňování „den / dny / dní" přes existující `src/utils/pluralize.js`.

---

## 8. Testy

Vitest v `shared/availability.test.js`:

- prázdný den → 🔴, `filled` 0, chybí všechny pozice,
- přesně 4 lidé celý den se správnými rolemi → 🟢,
- VD + Strojník v jedné osobě jako jediný nositel obou rolí → nejvýše jedna z pozic,
- dva lidé s vlastními časy vytvářející mezeru → 🟡 se správnými rozsahy,
- absence přebíjí ruční záznam,
- denní služba s časy slotu i bez nich,
- člen jen s rolí `Admin` se nepočítá,
- `normalizeSlots`: sloučení při stejném dojezdu, chyba při překryvu s různým dojezdem, dotýkající se úseky s různým dojezdem zůstanou oddělené,
- `validateSlots`: `od >= do`, mimo 05–18, dojezd 0 / 181 / neceločíselný, více než 3 úseky,
- `summarizeMonth`: počty stavů, `missingByPosition`, hodiny a vážený průměr dojezdu, ignorování dnů po dnešku.

---

## 9. Dotčené soubory (orientačně)

- **Nové:** `shared/availability.js`, `shared/availability.test.js`, `src/hooks/useAvailability.js`, `src/components/dashboard/AvailabilityCard.jsx` (+ případné podkomponenty pro pás, panel dne a editor času), `src/components/statistics/AvailabilityTab.jsx`.
- **Upravené:** `src/pages/DashboardPage.jsx`, `src/pages/StatisticsPage.jsx`, `src/components/admin/constants.js`, `firestore.rules` (nový blok + výjimka v zástupném pravidle), `README.md` (kolekce `availability`, zmínka v tabulce modulů u Dashboardu a Statistik), `src/changelog.js` (položka „Nové funkce"; zvýšení verze jen na výslovný pokyn).
- **Nasazení:** po změně `firestore.rules` je nutné pravidla nasadit ve Firebase konzoli.
