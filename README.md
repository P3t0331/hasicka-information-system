# Hasičský informační systém

Webová aplikace pro správu a organizaci dobrovolné hasičské jednotky. Pokrývá evidenci členů, plánování služeb, školení a akce, deníky údržby a úklidu, povinné kvízy a statistiky činnosti jednotky.

Běží jako PWA — dá se nainstalovat do telefonu a funguje i offline pro čtení.

> **Soukromý software** — viz [LICENSE](./LICENSE)

---

## Moduly

| Modul | Popis |
|-------|-------|
| **Dashboard** | Nadcházející akce, příští služba, nástěnka, počasí a výstrahy pro Brno, upozornění na nesplněné kvízy |
| **Služby** | Plánování nočních a denních směn i záloh a stáží, docházková evidence, absence |
| **Školení** | Evidence školení s přihlašováním členů, šablony pro opakované akce, sekce s přiřazenými kvízy |
| **Kvízy** | Povinné testy ke školením — viz [samostatná sekce](#kvízy) |
| **Akce** | Plánování výjezdů, srazů a dalších aktivit jednotky |
| **Údržba** | Deník údržby techniky a vybavení |
| **Úklid** | Evidence úklidů stanice |
| **Statistiky** | Odpracované hodiny, docházka a aktivita členů v grafech |
| **Členové** | Seznam členů s kontakty a kvalifikacemi |
| **Profil** | Osobní údaje, evidence výbavy, absence, historie absolvovaných kvízů |
| **Návrhy** | Náměty od členů a jejich vyřizování |
| **Administrace** | Uživatelé a role, vybavení, nástěnka, odkazy, návrhy, kvízy, logy činnosti |

---

## Kvízy

Velitel sestaví v administraci test, zveřejní ho s termínem, členové ho vyplní na telefonu a systém ho vyhodnotí. Výstupem je tiskový protokol, kterým jednotka doloží při kontrole, že školení proběhlo.

**Sestavení a zadání.** Čtyři typy otázek — jedna správná, více správných, ano/ne a otevřená odpověď. U kvízu se nastavuje hranice úspěšnosti, počet pokusů, volitelný časový limit, míchání otázek i voleb a to, zda se po odeslání ukáže rozbor správných odpovědí. Kvíz se zadává všem aktivním členům, vybraným rolím, nebo účastníkům konkrétního školení.

**Vyplňování.** Odpovědi se průběžně ukládají, takže výpadek signálu ani zavření prohlížeče rozpracovaný kvíz nezahodí. Po termínu jde kvíz vyplnit dál, jen se odevzdání označí jako opožděné.

**Vyhodnocení.** Volbové otázky vyhodnotí server, otevřené odpovědi ohodnotí velitel ručně. Dokud není ohodnocená každá otevřená otázka, zůstává pokus ve stavu „Čeká na vyhodnocení" a nemá skóre.

**Přehledy.** Tabulka členů se stavem a skóre, detail odpovědí jednotlivce, statistika úspěšnosti po otázkách (nejhorší nahoře) a tiskový protokol s podpisovým polem.

**Notifikace.** Volitelně při zveřejnění, automaticky tři dny a den před termínem, ručním tlačítkem kdykoliv, a členovi po dohodnocení jeho odpovědí.

### Bezpečnost kvízů

Správné odpovědi nejsou v dokumentu kvízu — leží v oddělené kolekci `quizAnswerKeys`, kterou podle pravidel Firestore přečte jen správce. Vyhodnocení proto běží na serveru ve funkci `api/quiz-submit.js` s Firebase Admin SDK. Člen smí ve svém rozpracovaném pokusu měnit výhradně pole `answers` a `lastSavedAt`; stav ani skóre si přepsat nemůže.

---

## Technologie

- **Frontend:** React 19, React Router 7, Vite 7
- **Backend:** Firebase (Authentication, Firestore) + serverless funkce na Vercelu
- **PWA:** vite-plugin-pwa, Workbox — instalovatelná aplikace s offline podporou
- **Notifikace:** Web Push (`web-push`, VAPID), servisní worker
- **Grafy:** Recharts
- **E-mail:** EmailJS (schválení a deaktivace účtu)
- **Testy:** Vitest
- **Deployment:** Vercel

### Struktura

```
src/              klientská aplikace (stránky, komponenty, hooky)
shared/           čistá logika sdílená klientem i serverem (vyhodnocení kvízů, stavy) + testy
api/              serverless funkce na Vercelu
firestore.rules   bezpečnostní pravidla databáze
docs/superpowers/ návrhové dokumenty a plány
```

Složka `shared/` je záměrně mimo `src/`, protože ji importuje prohlížeč i serverless funkce — vyhodnocení kvízu tak existuje v jedné jediné implementaci.

### Serverless funkce

| Funkce | Účel |
|--------|------|
| `api/quiz-submit.js` | Vyhodnocení odevzdaného kvízu proti klíči odpovědí |
| `api/quiz-reminders.js` | Připomínky před termínem, spouští denní cron v 6:00 UTC |
| `api/send-notification.js` | Odesílání push notifikací |
| `api/weather-warnings.js` | Výstrahy počasí pro dashboard |

---

## Instalace a spuštění

### Požadavky

- Node.js 18+
- Firebase projekt s Firestore a Authentication
- Účet na Vercelu (pro serverless funkce a cron)

### Nastavení

```bash
git clone <repozitář>
cd hasicka-information-system
npm install
```

Vytvořte soubor `.env` s klientskými proměnnými:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_WEATHER_API_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_APP_URL=
VITE_EMAILJS_PUBLIC_KEY=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID_APPROVAL=
VITE_EMAILJS_TEMPLATE_ID_DEACTIVATION=
```

Serverové proměnné patří **jen do nastavení projektu na Vercelu**, nikoliv do `.env` v repozitáři:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
VITE_VAPID_PUBLIC_KEY=
```

Nakonec nasaďte obsah [firestore.rules](./firestore.rules) ve Firebase konzoli (Firestore → Rules). Bez toho nebudou fungovat oprávnění u kvízů.

### Spuštění

```bash
npm run dev       # vývojový server
npm test          # testy sdílené logiky
npm run lint      # kontrola kódu
npm run build     # produkční build
npm run preview   # náhled produkčního buildu
```

> **Pozor:** `npm run dev` spouští pouze Vite, který složku `api/` neobsluhuje. Serverless funkce lokálně neběží, takže odeslání kvízu, push notifikace ani výstrahy počasí ve vývojovém režimu nefungují — otestujte je až na nasazené verzi, případně přes `vercel dev` s proměnnými staženými pomocí `vercel env pull`.

---

## Role uživatelů

| Role | Oprávnění |
|------|-----------|
| `Admin` | Plný přístup, správa systému, mazání zveřejněných kvízů |
| `VJ` | Velitel jednotky — správa služeb, školení, akcí a kvízů |
| `Zástupce VJ` | Stejná oprávnění jako VJ |
| `VD` | Velitel družstva — vytváření školení a akcí |
| `Strojník` | Přihlašování na strojnické pozice |
| `Hasič` | Základní přístup, přihlašování na služby a akce, vyplňování kvízů |
| `Přístup do Administrace` | Samostatné oprávnění vstupu do administrace bez velitelských práv |

Role `Admin`, `VJ` a `Zástupce VJ` získávají přístup do administrace automaticky.

---

## Datové kolekce

`users` · `shifts` · `absences` · `trainings` · `trainingTemplates` · `events` · `eventTemplates` · `quizzes` · `quizAnswerKeys` · `quizAttempts` · `maintenanceLogs` · `cleaningLogs` · `bulletinPosts` · `suggestions` · `settings` · `activityLogs` · `pushSubscriptions`

---

## Autor

**Peter Greguš**

---

## Licence

Copyright (c) 2025 Peter Greguš. Všechna práva vyhrazena.
Viz [LICENSE](./LICENSE).
