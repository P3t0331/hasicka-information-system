# Nastavení profilu — návrh funkcionality

**Datum:** 23. 8. 2026
**Stav:** návrh odsouhlasen, čeká na implementační plán

---

## 1. Účel

Aplikace zatím nemá žádný systém uživatelských preferencí — vzhled, rozvržení dashboardu i push notifikace jsou pro všechny stejné a pevně dané. Cílem je dát členům možnost přizpůsobit si čtyři věci, které se v praxi liší člověk od člověka:

- barevné téma (světlé/tmavé),
- kterou stránku uvidí hned po přihlášení,
- které widgety na dashboardu chtějí vidět a v jakém pořadí,
- o kterých typech push notifikací chtějí být informováni.

**Rozsah:** nová záložka **Nastavení** v Profilu + potřebná úprava `index.css` na CSS proměnné, aby tmavý režim fungoval napříč celou aplikací. Nejde o obecný systém rolí/oprávnění ani o widgety třetích stran — jen osobní preference nad tím, co už existuje.

**Mimo rozsah (vyřazeno při návrhu):** kompaktní/pohodlné zobrazení tabulek, tiché hodiny pro notifikace.

---

## 2. Rozhodnutí a jejich důvody

| Rozhodnutí | Zvolená varianta | Důvod |
|---|---|---|
| Datový model | Jedno pole `preferences` (mapa) na dokumentu uživatele | Žádná nová kolekce, jeden `updateDoc` na změnu, zapadá do stávajícího `useProfile` |
| Umístění v UI | Nová záložka „Nastavení" v Profilu, vedle ProfileInfo/EquipmentSection/QuizHistory | Vše o „mně" na jednom místě, žádná nová položka v hlavním menu |
| Ukládání změn | Okamžitě při změně (žádné tlačítko Uložit) | Stejné chování jako EquipmentSection |
| Retheme CSS | Plný převod `index.css` na proměnné v jednom commitu, před zapojením přepínače | ~121 natvrdo zapsaných barev; dílčí retheme by nechal část UI nesprávně obarvenou |
| Aplikace tématu | Atribut `data-theme` na `<html>`, řešeno přes `ThemeContext` + inline skript v `index.html` před prvním vykreslením | Zabrání bliknutí špatného tématu (flash of wrong theme) |
| Výchozí téma | `system` (podle nastavení zařízení) | Nejméně překvapivé chování pro nové i stávající uživatele |
| Výběr úvodní stránky | Omezeno na Dashboard, Služby, Školení, Kvízy | Čtyři stránky, které členové kontrolují jako první; ne celý seznam rolí-závislých tras |
| Cíl volby „Kvízy" | `/skoleni`, po načtení scroll na sekci Kvízy přes `id="kvizy-sekce"` + `scrollIntoView` | Kvízy dnes nejsou samostatná trasa, jen sekce na stránce Školení; bez toho by volba „Kvízy" dělala totéž co „Školení" |
| Widgety dashboardu | Přepínatelné: nástěnka, nejbližší služba, kvízy, měsíční statistiky, nadcházející aktivity, moje absence, důležité odkazy | Hlavní obsahové karty dashboardu |
| Bannery mimo výběr | WeatherWarnings, NewActivitiesBanner, ZalohaNotificationBanner zůstávají vždy viditelné | Časově citlivá upozornění, ne dekorativní obsah |
| Přeuspořádání widgetů | Šipky nahoru/dolů místo drag-and-drop | Aplikace se používá hlavně na mobilu (PWA); šipky jsou na dotykové obrazovce spolehlivější než drag |
| Chybějící preference u stávajících uživatelů | Výchozí pořadí, nic skryto, žádná migrace | `preferences.dashboardWidgets` se čte s fallbackem na výchozí hodnoty |
| Kategorie push notifikací | Kvízy, Služby, Školení, Akce | Odpovídá čtyřem místům v kódu, odkud se dnes push posílá (useQuizzes, useShiftCalendar, CreateTrainingModal, CreateEventModal) |
| Model opt-in/opt-out | Opt-out — bez `preferences` dostává uživatel vše | Zachovává současné chování pro existující uživatele |
| Filtrování na serveru | `api/send-notification.js` po zjištění cílových `userId` dohledá jejich `preferences.pushCategories` a vynechá zakázané | Filtrování musí být na serveru, klient nemá kontrolu nad tím, komu se push skutečně odešle |
| Zobrazení přepínačů bez push oprávnění | Zůstávají viditelné, ale neaktivní s vysvětlivkou | Uživatel vidí, že nastavení existuje, i než push povolí |

---

## 3. Datový model

```js
// users/{uid}.preferences
{
  theme: 'light' | 'dark' | 'system',        // výchozí 'system'
  landingPage: 'dashboard' | 'sluzby' | 'skoleni' | 'kvizy', // výchozí 'dashboard'; 'kvizy' → trasa '/skoleni' + scroll na sekci
  dashboardWidgets: {
    order: ['bulletin', 'nextShift', 'quiz', 'monthlyStats', 'upcomingActivities', 'myAbsences', 'importantLinks'],
    hidden: []
  },
  pushCategories: { kvizy: true, sluzby: true, skoleni: true, akce: true }
}
```

Pole se vytváří líně — při první změně v Nastavení. Chybějící pole/podpole se čtou s výchozími hodnotami výše, žádná migrace existujících uživatelů není potřeba.

---

## 4. Umístění v aplikaci

| Kde | Kdo | Co |
|---|---|---|
| Profil → záložka **Nastavení** | všichni přihlášení | Vzhled, úvodní stránka, widgety dashboardu, kategorie oznámení |
| `index.html` | — | Inline skript nastavující `data-theme` před prvním vykreslením |
| Dashboard | všichni | Respektuje `preferences.dashboardWidgets` (pořadí + skryté) |
| Přihlášení / vstup do appky | všichni | Přesměrování na `preferences.landingPage` místo pevné `/` |
| `api/send-notification.js` | — | Filtruje příjemce podle `preferences.pushCategories[category]` |

---

## 5. Komponenty a změny

### 5.1 Nová záložka Nastavení (`SettingsSection.jsx`)

Čtyři podsekce:

- **Vzhled** — rádio: Světlé / Tmavé / Podle systému
- **Úvodní stránka** — dropdown: Dashboard / Služby / Školení / Kvízy
- **Nástěnka** — seznam 7 widgetů, checkbox pro zobrazit/skrýt + šipky nahoru/dolů pro pořadí
- **Oznámení** — 4 přepínače (Kvízy / Služby / Školení / Akce); neaktivní s vysvětlivkou, pokud prohlížeč nemá povolený push

Ukládání: každá změna rovnou volá `updateDoc(userRef, { preferences: {...} })` (merge na úrovni podpole, ne přepis celé mapy).

### 5.2 Retheme `index.css` + `ThemeContext`

- Rozšíření `:root` proměnných tak, aby pokrývaly všechny barvy dnes zapsané natvrdo (pozadí, text, okraje, karty, stavové barvy, stíny).
- Paralelní tmavá sada navazující na existující `--bg-dark` / `--bg-dark-paper`.
- Nový `ThemeContext` (vedle `AuthContext`/`ToastContext`): čte `preferences.theme`, `system` řeší přes `prefers-color-scheme`, nastavuje `data-theme` na `<html>`.
- Inline skript v `index.html`, který nastaví `data-theme` ještě před prvním vykreslením Reactu (čte z `localStorage` cache preference, se kterou `ThemeContext` po načtení dat sesynchronizuje).
- Samostatný commit odděleně od zapojení přepínače, aby šla vizuální regrese snadno izolovat.

### 5.3 Dashboard — konfigurovatelné widgety

- Widgety `DashboardPage.jsx` se přesunou do konfiguračního pole (`id`, komponenta, výchozí pozice).
- Vykreslování mapováním přes `preferences.dashboardWidgets.order`, s vynecháním `id` z `hidden`.
- Bannery (WeatherWarnings, NewActivitiesBanner, ZalohaNotificationBanner) zůstávají mimo konfigurovatelný seznam, vždy nahoře.

### 5.4 Úvodní stránka

- Po načtení `userData` a existenci `preferences.landingPage` (jiné než `'dashboard'`) přesměrování z `/` na cílovou trasu — úprava na úrovni top-level routy/App komponenty, ne přepis routeru.
- Hodnota `'kvizy'` přesměruje na `/skoleni` a po vykreslení stránky provede `scrollIntoView` na sekci Kvízy (potřeba přidat `id="kvizy-sekce"` do `TrainingsPage.jsx`, dnes neexistuje).

### 5.5 Push notifikace podle kategorie

- Klient: 4 místa odesílající push (`useQuizzes`, `useShiftCalendar`, `CreateTrainingModal`, `CreateEventModal`, plus `api/quiz-reminders.js`) doplní pole `category` do volání `send-notification`.
- Server (`api/send-notification.js`): po vyřešení cílových `userId` dohledá jejich `preferences.pushCategories`; uživatele s `[category] === false` vynechá z odeslání. Uživatelé bez `preferences` dostávají vše (opt-out model).

---

## 6. Testování

- Sdílená logika (výpočet výchozí `preferences`, filtrování widgetů podle `hidden`/`order`) pokryta unit testy stejně jako zbytek `shared/`.
- `api/send-notification.js` filtr podle kategorie ověřen testem na úrovni funkce (mock Firestore).
- Retheme ověřen vizuální kontrolou hlavních obrazovek v obou režimech (Dashboard, Služby, Kvízy, Administrace) — bez automatizovaného vizuálního testu.
