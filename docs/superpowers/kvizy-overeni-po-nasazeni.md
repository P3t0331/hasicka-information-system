# Kvízy — ověření po nasazení

Seznam kroků, které nešlo ověřit při vývoji, protože vyžadují nasazenou aplikaci, přihlášení nebo tiskárnu. Projděte je po nasazení větve `feature/kvizy`.

Firestore pravidla už nasazená a ověřená jsou (kontrolní bod 1) — tahle část se týká aplikačního kódu.

---

## 1. Serverová funkce se vůbec spustí

**Tohle udělejte první.** Je to jediná věc, kterou nešlo ověřit ani nepřímo, a když nebude fungovat, nepůjde odeslat žádný kvíz.

`api/quiz-submit.js` importuje logiku ze složky `shared/`, tedy mimo adresář `api/`. Podle dokumentace to Vercel při buildu zabalí správně, ale potvrdit to jde až za běhu.

Po nasazení odešlete testovací kvíz a otevřete Vercel → Deployments → Functions → `quiz-submit` → Logs.

- **Když je v logu `Cannot find module '../shared/quizScoring.js'`** — přidejte do `vercel.json` vedle `rewrites` a `crons`:
  ```json
  "functions": { "api/**/*.js": { "includeFiles": "shared/**" } }
  ```
  a nasaďte znovu.
- Když tam nic takového není a kvíz se vyhodnotil, je hotovo.

---

## 2. Celý průchod kvízem

Jako **Admin** založte testovací kvíz se všemi čtyřmi typy otázek, hranicí 80 %, dvěma pokusy a časovým limitem pár minut. Zveřejněte ho.

Jako **hasič** ověřte:

| Co zkusit | Co má nastat |
|---|---|
| Vyplnit půlku, zavřít prohlížeč, vrátit se | Odpovědi i pořadí otázek zachované |
| Odpovědět a hned zavřít kartu | Odpověď uložená (ukládá se i při odchodu ze stránky) |
| Nechat vypršet časový limit | Odešle se samo s tím, co je uložené |
| Vícenásobná volba jen zčásti správně | 0 bodů, ne částečné |
| Kvíz s otevřenou otázkou | Po odeslání „Čeká na vyhodnocení", **žádné procento** |
| Neuspět a zkusit znovu | Druhý pokus jde, třetí už ne |
| Odeslat po termínu | Štítek „Po termínu" v přehledu i v protokolu |

---

## 3. Ruční hodnocení

Jako Admin otevřete Administrace → Kvízy → Výsledky → detail člena.

- Ohodnoťte textovku **Uznat** i **Neuznat** — skóre se přepočítá, stav se změní.
- U kvízu se **dvěma** textovkami po ohodnocení jen jedné musí stav zůstat „Čeká na vyhodnocení" a skóre prázdné.
- Po dohodnocení má členovi dorazit notifikace — a jen jedna, i když textovek bylo víc.

---

## 4. Tiskový protokol

Administrace → Kvízy → Výsledky → **Protokol**. Otevře se v nové kartě, dejte Tisk → Uložit jako PDF.

- Vejde se na šířku A4
- Diakritika je v pořádku
- **Hlavička tabulky se opakuje na druhé straně** — otestujte s dostatkem členů, aby protokol přesáhl jednu stranu
- Verdikt „Splnil / Nesplnil" je čitelný i černobíle
- V PDF není navigace ani tlačítko Vytisknout

Než protokol poprvé vytisknete, nastavte název jednotky: Administrace → Kvízy, pole nahoře nad seznamem.

---

## 5. Notifikace

- **Zveřejnění kvízu** se zaškrtnutým „Upozornit členy" → push dorazí
- **Ruční připomínka** v přehledu výsledků → dorazí jen těm, kdo nesplnili
- **Stávající notifikace fungují dál** — vyzkoušejte něco u směn nebo akcí. Endpoint se rozšiřoval, tak ať je jisté, že se nic nerozbilo.

---

## 6. Automatické připomínky

Nastavte testovacímu kvízu termín za tři dny a otevřete `https://<doména>/api/quiz-reminders` v prohlížeči.

- Vrátí JSON se souhrnem a push dorazí nesplněným členům
- **Spusťte to znovu tentýž den** — už nesmí odeslat nic. Tohle je to podstatné: chrání to členy před dvojitou dávkou notifikací.

Cron pak běží sám každý den v 6:00 UTC (8:00 letního času).

---

## 7. Kontrola oprávnění z konzole

Přihlaste se jako **běžný člen**, otevřete konzoli prohlížeče (F12) a zkuste:

```js
const { getFirestore, doc, getDoc } = await import('firebase/firestore');
await getDoc(doc(getFirestore(), 'quizAnswerKeys', '<id kvízu>'));
```

Očekávaný výsledek: `FirebaseError: Missing or insufficient permissions`.

Pokud by se správné odpovědi načetly, **nenasazujte to ostře** a dejte vědět.

---

## Známá omezení

Nejde o chyby — jsou to vědomá rozhodnutí, ať o nich víte.

**Limit pokusů hlídá jen klient.** Pravidla při zakládání pokusu kontrolují vlastníka a stav, ne počet, a serverová funkce pokusy nezakládá. Kdo si otevře konzoli, může si založit pokus nad rámec limitu a nechat si ho ohodnotit. Správné odpovědi tím nezíská. Dá se to dotáhnout tak, že endpoint při odeslání spočítá odevzdané pokusy a nadlimitní odmítne — řekněte, jestli do toho jít.

**Endpoint připomínek nemá ověření.** Je dostupný komukoliv, kdo zná URL, aby šel spustit ručně. Díky idempotenci s ním cizí člověk nic nenadělá — druhé spuštění téhož dne neodešle nic.

**Zmeškaná připomínka místo dvojité.** Kdyby zápis do databáze prošel a rozeslání pak selhalo, připomínka se ten den už nepošle. Je to záměr: dvojitá dávka pushů by lidi přiměla notifikace vypnout, zatímco zmeškaná třídenní připomínka za dva dny stejně přijde jako jednodenní.

**Protokol se tiskne přes prohlížeč**, ne generovanou PDF knihovnou. Žádná nová závislost, žádné potíže s diakritikou.
