# Kvízy — návrh funkcionality

**Datum:** 18. 8. 2026
**Stav:** návrh odsouhlasen, čeká na implementační plán

---

## 1. Účel

Jednotka potřebuje prokazatelně doložit, že členové absolvovali povinná školení. Dnes se školení eviduje jen jako účast na akci — chybí ověření, že člen látku skutečně zná, a chybí dokument pro kontrolu.

Kvízy tuto mezeru zavírají: osoba s přístupem do Administrace sestaví test, zadá ho členům s termínem, systém sbírá odpovědi, vyhodnocuje je a poskytne tiskový protokol o absolvování.

**Rozsah:** modul kvízů uvnitř stávající aplikace. Nejde o e-learning — žádné studijní materiály, kurzy ani lekce. Jen test, výsledek a doklad.

---

## 2. Rozhodnutí a jejich důvody

| Rozhodnutí | Zvolená varianta | Důvod |
|---|---|---|
| Přiřazení | Výchozí všichni aktivní členové, volitelně jen vybrané role, volitelně účastníci školení | Povinné školení se týká celé jednotky; role řeší výjimky (např. jen strojníci) |
| Typy otázek | Jedna správná, více správných, ano/ne, otevřená textová | Pokrývá formu reálných testů |
| Bodování | Procenta + hranice úspěšnosti | Srozumitelné, nevyžaduje váhy u otázek |
| Termín | Po termínu lze vyplnit, odevzdání se označí jako opožděné | Cílem je, aby školení nakonec absolvovali všichni, ne trestat zmeškání |
| Pokusy | Nastaví admin u kvízu | Různá školení mají různou přísnost |
| Textové odpovědi | Automatická část ihned, text dohodnotí admin | Text nelze spolehlivě vyhodnotit strojově |
| Zpětná vazba | Nastaví admin u kvízu | U některých testů je rozbor žádoucí, u jiných prozrazuje odpovědi |
| Volitelné mechaniky | Časový limit, míchání pořadí, vysvětlení u otázky | Vyžádáno |
| Umístění | Administrace (správa), Školení (vyplňování), Dashboard (upozornění), Profil (historie) | Bez další položky v hlavním menu |
| Oprávnění ke správě | Pouze role s přístupem do Administrace (Admin, VJ, Zástupce VJ) | Sjednoceno s přístupem do Administrace; VD kvízy nezakládá |
| Znovupoužití | Duplikace kvízu | Jednodušší než šablony i banka otázek a pro roční opakování stačí |
| Export | Tisková stránka + Tisk do PDF | Bez nové závislosti, plná kontrola vzhledu, bezproblémová diakritika |
| Připomínky | Automatický denní cron + ruční tlačítko | Automatika drží termíny, ruční tlačítko dává adminovi kontrolu |
| Bezpečnost | Správné odpovědi v oddělené kolekci, vyhodnocení na serveru | Bez toho by odpovědi přečetl kdokoliv přihlášený přes konzoli prohlížeče |
| Úpravy po zveřejnění | Koncept → Zveřejněno; poté jen metadata | Změna otázek by znehodnotila již odevzdané pokusy |
| Noví členové | Přiřazení se počítá živě | Nově přijatý člen musí povinné školení absolvovat také |
| Rozpracovaný pokus | Průběžné ukládání | Vyplňuje se hlavně na mobilu, výpadek nesmí zahodit práci |

---

## 3. Umístění v aplikaci

| Kde | Kdo | Co |
|---|---|---|
| Administrace → záložka **Kvízy** | Admin, VJ, Zástupce VJ | Zakládání, editace, zveřejnění, výsledky, ruční hodnocení, protokol, připomínky |
| Školení → sekce **Kvízy** | všichni | Moje kvízy k vyplnění a splněné; vstup do vyplňování |
| Dashboard → widget | všichni | Upozornění na nesplněné kvízy s odpočtem do termínu |
| Profil → karta | všichni | Historie mých kvízů a výsledků |

Do hlavní navigace nepřibývá žádná položka. Vyplňování a protokol mají vlastní routy, ale nejsou v menu.

---

## 4. Datový model

### 4.1 `quizzes/{quizId}`

Metadata a znění otázek. **Neobsahuje správné odpovědi.**

```
title: string
description: string
status: 'draft' | 'published' | 'closed'
trainingId: string | null              // volitelná vazba na dokument ve `trainings`
assignment: {
  mode: 'all' | 'roles' | 'training',
  roles: string[]                      // použito jen při mode === 'roles'
}
deadline: 'YYYY-MM-DD'                 // platí do konce dne
passThreshold: number                  // %, výchozí 80
maxAttempts: number                    // 0 = neomezeně, výchozí 3
timeLimitMinutes: number | null        // null = bez limitu
shuffleQuestions: boolean
shuffleOptions: boolean
showCorrectAnswers: boolean            // rozbor po odeslání
notifyOnPublish: boolean
questions: [
  {
    id: string,                        // stabilní, generuje se při vytvoření otázky
    type: 'single' | 'multi' | 'boolean' | 'text',
    text: string,
    options: [{ id: string, text: string }]   // prázdné u typu 'text'
  }
]
createdBy: { uid, name }
createdAt: ISO string
publishedAt: ISO string | null
closedAt: ISO string | null
```

`mode: 'training'` je povolen jen tehdy, když je vyplněn `trainingId`; přiřazenými jsou pak účastníci daného školení.

### 4.2 `quizAnswerKeys/{quizId}`

Správné odpovědi a vysvětlení. Čte a zapisuje pouze role s přístupem do Administrace a serverový endpoint (Admin SDK pravidla obchází).

```
answers: {
  [questionId]: {
    correct: string[] | boolean,       // pole ID voleb; boolean u typu 'boolean'
    autoGraded: boolean                // false u typu 'text'
  }
}
explanations: { [questionId]: string }
```

Dokument vzniká i zaniká spolu s kvízem.

### 4.3 `quizAttempts/{quizId}_{uid}_{attemptNumber}`

Jeden dokument na pokus. Slouží zároveň jako úložiště rozpracovaného vyplňování.

```
quizId: string
uid: string
userName: string                       // denormalizováno pro protokol
attemptNumber: number                  // od 1
status: 'in_progress' | 'pending_review' | 'passed' | 'failed'
order: {
  questionIds: string[],               // zamíchané pořadí otázek
  optionOrder: { [questionId]: string[] }
}
answers: { [questionId]: string[] | string }
startedAt: ISO string
lastSavedAt: ISO string
submittedAt: ISO string | null
isLate: boolean
timeExpired: boolean                   // odesláno až po vypršení časového limitu
questionCount: number                  // snapshot počtu otázek při odeslání
autoCorrectCount: number               // správně zodpovězené automatické otázky
scorePercent: number | null
passed: boolean | null
manualGrades: { [questionId]: 0 | 1 }
gradedBy: { uid, name } | null
gradedAt: ISO string | null
```

Deterministické ID dokumentu zabrání vzniku duplicitních souběžných pokusů.

### 4.4 Odvozený stav člena

Stav se nikde neukládá, počítá se z pokusů daného člena:

| Podmínka | Zobrazený stav |
|---|---|
| žádný pokus | Nezahájeno |
| existuje pokus `in_progress` | Rozpracováno |
| nejnovější odevzdaný je `pending_review` | Čeká na vyhodnocení |
| existuje pokus `passed` | Splnil |
| všechny odevzdané `failed` | Nesplnil |

Platí **nejlepší** dosažený pokus. Kterýkoliv odevzdaný pokus s `isLate: true` přidá štítek „po termínu".

---

## 5. Bodování

Každá otázka má hodnotu 1 bodu.

- **Jedna správná** — bod za shodu se správnou volbou.
- **Více správných** — bod jen za přesnou shodu množiny; částečná shoda je 0.
- **Ano/ne** — bod za shodu.
- **Otevřená** — automaticky se nehodnotí. Admin ji označí **Uznáno (1)** nebo **Neuznáno (0)**.

`scorePercent = round(získané body / počet otázek × 100)`, výsledek je Splnil při `scorePercent >= passThreshold`.

Kvíz obsahující alespoň jednu otevřenou otázku dostane po odeslání stav `pending_review`. Skóre se dopočítá a stav se změní na `passed`/`failed` až po dohodnocení adminem.

---

## 6. Bezpečnost

### 6.1 Problém

Současná pravidla:

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

Firestore pravidla se sčítají — pokud jakýkoliv `match` operaci povolí, je povolena. Dokud tento rekurzivní wildcard existuje, žádné přísnější pravidlo pod ním neplatí a přihlášený člen si správné odpovědi i cizí pokusy přečte přes konzoli prohlížeče.

### 6.2 Řešení

Rekurzivní wildcard se nahradí wildcardem s pojmenovaným prvním segmentem, ze kterého se dvě nové kolekce vyjmou:

```
function isSignedIn() { return request.auth != null; }

function userRoles() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roles;
}

function isElevated() {
  return isSignedIn() && userRoles().hasAny(['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ']);
}

match /{collection}/{document=**} {
  allow read, write: if isSignedIn()
    && collection != 'quizAnswerKeys'
    && collection != 'quizAttempts';
}

match /quizAnswerKeys/{quizId} {
  allow read, write: if isElevated();
}

match /quizAttempts/{attemptId} {
  allow read: if isElevated() || resource.data.uid == request.auth.uid;
  allow create: if request.resource.data.uid == request.auth.uid
                && request.resource.data.status == 'in_progress';
  allow update: if isElevated()
                || (resource.data.uid == request.auth.uid
                    && resource.data.status == 'in_progress'
                    && request.resource.data.status == 'in_progress'
                    && request.resource.data.startedAt == resource.data.startedAt
                    && request.resource.data.attemptNumber == resource.data.attemptNumber);
  allow delete: if isElevated();
}

match /pushSubscriptions/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

Pozor na jeden detail: `isElevated()` čte pole `roles` z dokumentu uživatele. Pokud některý starší účet má jen legacy pole `role`, výraz selže a přístup se zamítne. Implementace proto musí počítat s oběma tvary — před nasazením pravidel je nutné ověřit, že všechny účty s elevovanými rolemi mají pole `roles`.

Pokrytí zůstává pro všechny stávající kolekce nezměněné — mění se jen zápis wildcardu a vyjímají se dvě nové kolekce. Klient tak nemůže sám přepnout pokus do stavu `passed` ani si posunout `startedAt` a obejít časový limit.

### 6.3 Serverové vyhodnocení

Nový endpoint **`api/quiz-submit.js`** (Firebase Admin SDK, už je v závislostech; stejný vzor jako `api/send-notification.js`):

1. Ověří ID token z hlavičky `Authorization`.
2. Načte kvíz, klíč a dotčený pokus.
3. Zkontroluje, že pokus patří volajícímu, je ve stavu `in_progress`, nepřekročil `maxAttempts` a nevypršel `timeLimitMinutes` (počítáno od `startedAt` na serveru).
4. Vyhodnotí automatické otázky, spočítá skóre, nastaví `isLate` podle `deadline`.
5. Zapíše `pending_review` (jsou-li textovky), jinak `passed` / `failed`.
6. Vrátí výsledek a — pokud má kvíz `showCorrectAnswers` — i rozbor se správnými odpověďmi a vysvětleními.

Správné odpovědi se ke klientovi dostanou výhradně touto cestou, až po odeslání.

---

## 7. Obrazovky a toky

### 7.1 Administrace → Kvízy

Seznam s filtrem Koncepty / Aktivní / Uzavřené. U každého kvízu název, termín, přiřazení a průběh („14/22 splnilo").

### 7.2 Editor kvízu — `/admin/kviz/:id`

Samostatná stránka, ne modal: kvíz o dvaceti otázkách se v modalu na mobilu nedá rozumně editovat.

Horní část — nastavení: název, popis, vazba na školení, přiřazení, termín, hranice úspěšnosti, počet pokusů, časový limit, přepínače míchání otázek a voleb a zobrazení správných odpovědí, přepínač upozornění při zveřejnění.

Dolní část — otázky: přidat, duplikovat, přesunout nahoru/dolů, smazat. U každé otázky typ, znění, volby s označením správných a volitelné vysvětlení.

Ukládá se jako **koncept** — pro ostatní členy neviditelný.

**Zveřejnit** ověří, že kvíz má alespoň jednu otázku, každá volbová otázka má alespoň jednu označenou správnou volbu a alespoň dvě volby, a že termín je v budoucnu. Po zveřejnění lze měnit už jen název, popis, termín a přiřazení; otázky jsou zamčené.

Dále **Vytvořit kopii** (nový koncept se stejnými otázkami a novým termínem) a **Uzavřít** (předčasné ukončení, výsledky zůstávají).

### 7.3 Vyplňování — Školení → Kvízy → `/skoleni/kviz/:id`

Karta kvízu ukazuje název, termín, odpočet a stav. Po otevření úvodní obrazovka: počet otázek, hranice úspěšnosti, zbývající pokusy, časový limit, popis. Tlačítko **Zahájit** vytvoří pokus, zamíchá pořadí a uloží je do `order`.

Otázky jsou pod sebou na jedné stránce. Po každé změně odpovědi se pokus po krátké prodlevě (≈ 1 s) uloží. Zavření prohlížeče nevadí — návrat pokračuje se stejnými odpověďmi i stejným pořadím. Při časovém limitu běží odpočet; po vypršení se odešle to, co je uložené.

**Odeslat** upozorní na nezodpovězené otázky, po potvrzení volá `api/quiz-submit` a zobrazí výsledek: skóre, Splnil/Nesplnil a — je-li povoleno — rozbor po otázkách se správnou odpovědí a vysvětlením. U kvízu s textovkami se místo výsledku zobrazí „Čeká na vyhodnocení".

Po termínu zůstává kvíz otevřený, ale s viditelným upozorněním; odevzdání dostane příznak opožděno.

### 7.4 Výsledky kvízu (Administrace)

Tři pohledy:

1. **Tabulka členů** — jméno, stav, skóre, datum odevzdání, počet pokusů, štítek „po termínu". Filtr podle stavu, řazení, souhrn nahoře (splnilo / nesplnilo / nevyplnilo).
2. **Detail člena** — otázka po otázce jeho odpověď proti správné. U textových otázek tlačítka **Uznat / Neuznat**; po dohodnocení se přepočítá skóre, nastaví `passed`/`failed` a odešle push.
3. **Statistika otázek** — úspěšnost každé otázky v procentech, seřazeno od nejhorší.

Nad tabulkou tlačítka **Protokol** a **Poslat připomínku**.

### 7.5 Dashboard widget

Zobrazí se jen tehdy, má-li člen nesplněný přiřazený kvíz. Ukáže název, odpočet do termínu a odkaz na vyplnění. Po termínu se zvýrazní.

### 7.6 Karta v Profilu

Chronologický seznam kvízů člena: název, datum, skóre, výsledek. Slouží jako osobní přehled absolvovaných školení.

---

## 8. PDF protokol

Tlačítko **Protokol o školení** otevře v nové kartě `/kviz/:id/protokol` — samostatnou stránku mimo `Layout`, určenou k tisku (formát A4, `@media print` bez navigace a ovládacích prvků). Uživatel použije Tisk → Uložit jako PDF.

Obsah:

- **Hlavička** — název jednotky, název kvízu, navázané školení, období a termín, kdo kvíz zadal, datum vygenerování.
- **Tabulka členů** — jméno, datum splnění, skóre v %, výsledek Splnil/Nesplnil.
- **Souhrn** — počet přiřazených, splnilo, nesplnilo, nevyplnilo, hranice úspěšnosti.
- **Podpisové pole** — místo pro podpis velitele jednotky a razítko.

Řešeno bez nové závislosti; diakritika je tak bez rizika a stránka vypadá stejně na mobilu i na počítači.

---

## 9. Notifikace

Využívá stávající push infrastrukturu (`api/send-notification.js`, `usePushNotifications`).

| Událost | Komu | Poznámka |
|---|---|---|
| Zveřejnění kvízu | přiřazeným členům | Jen pokud admin zaškrtl „Upozornit členy" |
| Připomínka 3 dny a 1 den před termínem | nesplněným členům | Automaticky přes denní Vercel cron |
| Ruční připomínka | nesplněným členům | Tlačítko v tabulce výsledků |
| Dohodnocení textovek | dotčenému členovi | Výsledek kvízu |

Nový endpoint **`api/quiz-reminders.js`** volaný denním cronem zapsaným do `vercel.json`. Projde zveřejněné kvízy s blížícím se termínem, dopočítá nesplněné členy a odešle push. Zapíše si datum odeslání na dokument kvízu, aby se připomínka téhož dne neopakovala.

Stávající `api/send-notification.js` se rozšíří o pole `targetUserIds: string[]` (dnes umí jen jednoho uživatele nebo role) — potřebné pro cílení na konkrétní seznam nesplněných členů.

---

## 10. Hraniční případy

| Situace | Chování |
|---|---|
| Vyčerpané pokusy | Kvíz jen ke čtení s posledním výsledkem |
| Souběžné vyplňování na dvou zařízeních | Jeden pokus s deterministickým ID; platí poslední zápis |
| Vypršení limitu při zavřeném prohlížeči | Server při dalším pokusu o odeslání limit vyhodnotí a započítá jen uložené odpovědi |
| Deaktivovaný člen | Zmizí ze seznamu přiřazených, ale jeho odevzdaný pokus zůstává v protokolu |
| Změna rolí po zveřejnění | Přiřazení je živé — kvíz se členovi objeví nebo zmizí podle aktuálních rolí |
| Smazání kvízu | Smazat lze pouze koncept (včetně klíče). Zveřejněný kvíz s odpověďmi se uzavírá, nemaže — jinak by zmizel doklad o školení |
| Smazání navázaného školení | `trainingId` osiří; kvíz funguje dál, vazba se přestane zobrazovat |
| Kvíz bez otázek nebo bez označené správné volby | Zveřejnění zablokováno s konkrétní chybovou hláškou |
| Textovka bez odpovědi | Hodnotí se jako Neuznáno, dokud admin nerozhodne jinak |

---

## 11. Rozsah zásahů

### Nové soubory

**Hooky**
- `src/hooks/useQuizzes.js` — CRUD a seznam pro Administraci
- `src/hooks/useMyQuizzes.js` — kvízy přiřazené přihlášenému členovi a jejich stav
- `src/hooks/useQuizAttempt.js` — běh jednoho pokusu, průběžné ukládání, odeslání

**Administrace**
- `src/components/admin/QuizzesTab.jsx`
- `src/components/admin/quizzes/QuizEditor.jsx`
- `src/components/admin/quizzes/QuestionEditor.jsx`
- `src/components/admin/quizzes/QuizResultsTable.jsx`
- `src/components/admin/quizzes/QuizAttemptDetail.jsx`
- `src/components/admin/quizzes/QuestionStats.jsx`

**Vyplňování**
- `src/components/quizzes/QuizCard.jsx`
- `src/components/quizzes/QuizIntro.jsx`
- `src/components/quizzes/QuestionRenderer.jsx`
- `src/components/quizzes/QuizResultView.jsx`

**Ostatní**
- `src/components/dashboard/QuizWidget.jsx`
- `src/components/profile/QuizHistory.jsx`
- `src/pages/QuizTakePage.jsx` — `/skoleni/kviz/:id`
- `src/pages/QuizProtocolPage.jsx` — `/kviz/:id/protokol`
- `src/pages/AdminQuizEditorPage.jsx` — `/admin/kviz/:id`
- `api/quiz-submit.js`
- `api/quiz-reminders.js`

**Sdílená logika (klient i server)**
- `shared/quizScoring.js` — vyhodnocení odpovědí a výpočet skóre
- `shared/quizStatus.js` — přiřazení kvízu, odvození stavu člena, termín a časový limit
- `shared/quizScoring.test.js`, `shared/quizStatus.test.js`

### Změny stávajících souborů

- `src/App.jsx` — tři nové routy (protokol mimo `Layout`)
- `src/pages/AdminPage.jsx` — záložka Kvízy
- `src/pages/TrainingsPage.jsx` — sekce Kvízy
- `src/pages/DashboardPage.jsx` — widget
- `src/pages/ProfilePage.jsx` — karta historie
- `api/send-notification.js` — podpora `targetUserIds`
- `firestore.rules` — přepis wildcardu a pravidla nových kolekcí
- `vercel.json` — denní cron
- `src/changelog.js` — nová verze a popis funkce
- `package.json` — devDependency `vitest` a skript `test`
- `vitest.config.js` — nový konfigurační soubor pro testy sdílené logiky

---

## 12. Ověření

Projekt zatím testovací framework nemá. Pro tento modul se přidá **Vitest** a pokryje se jím čistá logika — vyhodnocování bodů, odvození stavu člena, kontrola termínu a časového limitu. Právě tam je chyba nejdražší: špatně spočítané skóre vypadá věrohodně a nikdo si ho nevšimne. Komponenty se ověřují ručně jako dosud.

Sdílená logika proto žije v samostatné složce `shared/`, kterou používá klient i serverový endpoint — vyhodnocení se nesmí implementovat dvakrát.

**Automaticky:** `npm test`, `npm run lint` a `npm run build` bez chyb.

**Manuální scénáře:**

1. Vyhodnocení všech čtyř typů otázek včetně částečné shody u vícenásobné volby (musí být 0 bodů).
2. Přerušení vyplňování a návrat — odpovědi i pořadí otázek zachovány.
3. Vyčerpání pokusů — další zahájení není možné.
4. Vypršení časového limitu — automatické odeslání uložených odpovědí.
5. Odeslání po termínu — příznak opožděno v tabulce i protokolu.
6. Ruční hodnocení textovky — přepočet skóre, změna stavu, odeslaná notifikace.
7. Zveřejnění kvízu bez správných odpovědí — zablokováno s hláškou.
8. Protokol — tisk do PDF, kontrola diakritiky a stránkování delší tabulky.

**Kontrola pravidel (nutná):**

9. Běžný člen nepřečte `quizAnswerKeys` ani cizí `quizAttempts`.
10. Běžný člen nedokáže přepsat vlastní pokus na `passed` ani změnit `startedAt`.
11. Všechny stávající moduly (Služby, Školení, Akce, Údržba, Úklid, Statistiky, Členové, Administrace, Nástěnka, Návrhy) fungují po změně pravidel beze změny.

Bod 11 je nejrizikovější částí celé implementace a je třeba ho projít modul po modulu.
