# Hasičský informační systém

Webová aplikace pro správu a organizaci dobrovolné hasičské jednotky. Umožňuje evidenci členů, plánování směn, školení, akcí, údržby techniky a dalších aktivit jednotky.

> **Soukromý software** — viz [LICENSE](./LICENSE)

---

## Funkce

| Modul | Popis |
|-------|-------|
| **Dashboard** | Přehled nadcházejících akcí, počasí a výstrah pro oblast Brno |
| **Služby** | Plánování nočních, denních směn a zálohy/stáže s docházkovou evidencí |
| **Školení** | Evidence školení s přihlašováním členů a šablonami pro opakované akce |
| **Akce** | Plánování výjezdů, srazů a jiných aktivit jednotky |
| **Údržba** | Deník údržby techniky a vybavení |
| **Úklid** | Evidence úklidů stanice |
| **Statistiky** | Přehledy odpracovaných hodin, docházky a aktivity členů |
| **Členové** | Správa členů, rolí a kontaktních údajů |
| **Profil** | Osobní profil s evidencí výbavy a absencí |
| **Administrace** | Správa systému, rolí, logů a nastavení |

---

## Technologie

- **Frontend:** React 19, React Router 7, Vite 7
- **Backend:** Firebase (Authentication, Firestore)
- **PWA:** vite-plugin-pwa, Workbox — instalovatelná aplikace s offline podporou
- **Grafy:** Recharts
- **Email:** EmailJS
- **Deployment:** Vercel

---

## Instalace a spuštění

### Požadavky
- Node.js 18+
- Firebase projekt s Firestore a Authentication

### Nastavení

```bash
git clone <repozitář>
cd hasicka-information-system
npm install
```

Vytvořte soubor `.env` podle vzoru:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_WEATHER_API_KEY=
VITE_EMAILJS_PUBLIC_KEY=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID_APPROVAL=
VITE_EMAILJS_TEMPLATE_ID_DEACTIVATION=
VITE_APP_URL=
```

### Spuštění

```bash
npm run dev       # vývojový server
npm run build     # produkční build
npm run preview   # náhled produkčního buildu
```

---

## Role uživatelů

| Role | Oprávnění |
|------|-----------|
| `Admin` | Plný přístup, správa systému |
| `VJ` | Velitel jednotky — správa směn, školení, akcí |
| `Zástupce VJ` | Stejná oprávnění jako VJ |
| `VD` | Velitel družstva — vytváření školení a akcí |
| `Strojník` | Přihlašování na strojnické pozice |
| `Hasič` | Základní přístup, přihlašování na směny a akce |

---

## Autor

**Peter Greguš**

---

## Licence

Copyright (c) 2025 Peter Greguš. Všechna práva vyhrazena.  
Viz [LICENSE](./LICENSE).
