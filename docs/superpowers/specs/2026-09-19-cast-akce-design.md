# Čas členů u akcí/školení — návrh funkcionality

**Datum:** 19. 9. 2026
**Stav:** návrh odsouhlasen, čeká na implementační plán

---

## 1. Účel

Člen přihlášený na akci nebo školení dnes nemá jak dát vědět, že tam nebude celou dobu („můžu jen do 16:00", „přijdu až v 10:00"). Organizátor to zjišťuje telefonem a statistiky počítají každému celou délku akce.

Nově si člen po přihlášení může zadat, **od kdy a/nebo do kdy** se zúčastní. Údaj vidí ostatní v seznamu účastníků a statistiky hodin počítají jen jeho skutečný úsek.

**Rozsah:** volitelné časy `from`/`until` u účastníka, sdílená logika v `shared/participantTimes.js`, transakční úprava v `src/utils/activityParticipants.js`, nová komponenta `ParticipationTimeControl` na všech 4 místech přihlašování, zobrazení v seznamech účastníků, přepočet hodin v záložce Aktivity ve Statistikách, záznam do logů.

**Mimo rozsah:** úprava časů jiného člena adminem, notifikace organizátorovi, volná textová poznámka.

---

## 2. Rozhodnutí a jejich důvody

| Rozhodnutí | Zvolená varianta | Důvod |
|---|---|---|
| Co lze zadat | Volitelně „Přijdu v" (`from`) a/nebo „Odejdu v" (`until`) | Pozdní příchod je stejně častý jako dřívější odchod |
| Statistiky | Hodiny se počítají jen z vlastního úseku člena | Jinak jsou hodiny nepravdivé |
| Průběh v UI | Přihlášení zůstává na jedno klepnutí; časy se nastavují až po přihlášení přes čip „⏱ Celou dobu" | Běžný případ zůstane rychlý; plány se mění, takže úprava musí jít kdykoliv |
| Datový model | Časy přímo na položce v poli `participants` | Odhlášení (`arrayRemove` celé položky) i admin mazání (filtr podle uid) fungují beze změny; nic se nemůže rozejít |
| Zpětná kompatibilita | Chybějící `from`/`until` = začátek/konec akce | Žádná migrace dat |

---

## 3. Datový model

Položka v `events/{id}.participants[]` a `trainings/{id}.participants[]`:

```js
{ uid, name, joinedAt, from?: 'HH:MM', until?: 'HH:MM' }
```

- Pole `from`/`until` jsou volitelná. Při uložení „Celou dobu" se z položky **odstraní** (neukládá se `null`), aby staré i nové položky vypadaly stejně.
- `firestore.rules` se nemění, protože pravidla pro `events`/`trainings` pole `participants` nevalidují.

---

## 4. Sdílená logika — `shared/participantTimes.js`

Pure funkce bez Firebase, testované v `shared/participantTimes.test.js`:

- `getParticipantWindow(activity, participant)` → `{ start, end }` jako `'HH:MM'` nebo `null`; `start = participant.from ?? activity.time`, `end = participant.until ?? activity.timeEnd ?? null`.
- `getParticipantHours(activity, participant)` → počet hodin z okna. Když chybí start nebo end, vrací 0 (stejně jako dnešní `getActivityHours`). Zachovává dnešní ošetření přechodu přes půlnoc.
- `formatParticipantTimes(participant)` → `'od 10:00'` | `'do 16:00'` | `'10:00–16:00'` | `null`.
- `validateParticipantTimes(activity, { from, until })` → `null` nebo česká chybová hláška:
  - `from` nesmí být před `activity.time`,
  - `until` nesmí být po `activity.timeEnd` (pokud je vyplněný),
  - když jsou vyplněné oba, musí platit `from < until`,
  - kontrola půlnoci: pokud `activity.timeEnd < activity.time` (akce přes půlnoc), přeskočí se kontrola rozsahu i pořadí a zkontroluje se jen formát.

`ActivitiesTab.getActivityHours` se nahradí voláním `getParticipantHours`.

---

## 5. Zápis — `src/utils/activityParticipants.js`

Nová funkce vedle `joinActivityTx`:

```js
updateParticipantTimesTx(db, collectionName, activityId, uid, { from, until })
```

- Transakce: načte dokument, najde položku podle `uid`, nastaví nebo odstraní `from`/`until`, zapíše celé pole.
- Chyby (`code`): `NOT_FOUND` (aktivita neexistuje), `NOT_JOINED` (uid není v seznamu).
- Validaci volá UI předem; funkce sama validaci neopakuje.

---

## 6. UI

### `src/components/activities/ParticipationTimeControl.jsx` (nová komponenta)

Props: `activity`, `collectionName`, `participant`, `userData`, `showToast`, `compact?`.

- Čip s textem `⏱ Celou dobu`, nebo `⏱ ` + `formatParticipantTimes(...)`.
- Klepnutí otevře malý modal: dva `<input type="time">` („Přijdu v", „Odejdu v"), nápověda s časem akce, tlačítka **Uložit**, **Celou dobu** (smaže oba časy) a **Zrušit**.
- Chyba z validace se zobrazí v modalu a uložení se zablokuje.
- Po uložení: `updateParticipantTimesTx`, toast „Uloženo.", `logAction(..., 'UPDATED_ACTIVITY_TIMES', 'activities', 'Upravil čas účasti na akci/školení „X" (datum): do 16:00')`. Při zpětném nastavení na „Celou dobu" je v textu logu „celou dobu".
- Barvy jen přes theme tokeny (`var(--…)`), žádné hex hodnoty.

### Zapojení (zobrazí se jen u přihlášeného člena a jen u aktivity, která ještě neproběhla)

| Místo | Soubor |
|---|---|
| Stránka Akce | `src/components/events/EventCard.jsx`, v patičce vedle „Odhlásit" |
| Stránka Školení | `src/components/trainings/TrainingCard.jsx`, v patičce vedle „Odhlásit" |
| Služby, inline seznam | `src/components/shifts/InlineActivities.jsx` (`compact`) |
| Služby, popup dne | `src/components/shifts/modals/ActivityPopup.jsx` |

### Seznam účastníků

V rozbaleném seznamu v `EventCard` a `TrainingCard` se za jméno přidá ztlumená přípona `· do 16:00` (výstup `formatParticipantTimes`, `color: var(--text-muted)`).

---

## 7. Chybové stavy

- `NOT_JOINED`: toast „Nejste přihlášen/a." (člen byl mezitím odhlášen).
- `NOT_FOUND`: toast „Aktivita už neexistuje."
- Ostatní chyby: `console.error` + toast „Chyba při ukládání."

---

## 8. Testování

- `shared/participantTimes.test.js`:
  - okno s i bez vlastních časů,
  - hodiny (celá doba, jen `until`, jen `from`, obojí, akce bez `timeEnd` → 0, přes půlnoc),
  - formátování všech variant,
  - validace (před začátkem, po konci, `from >= until`, akce bez `timeEnd`).
- `npm run build` a `npm test` musí projít.
- Ruční ověření v prohlížeči:
  - přihlášení, nastavení „do 16:00" na stránce Akce,
  - zobrazení v seznamu účastníků a na stránce Služby,
  - návrat na „Celou dobu",
  - odhlášení po nastavení časů (položka musí zmizet celá),
  - hodiny v záložce Aktivity ve Statistikách.
