/**
 * Vybere správný český tvar podle počtu (1 / 2–4 / 5+). Sdílené mezi
 * `QuizIntro` (počet otázek, pokusů, minut) a `QuizTakePage` (potvrzovací
 * dialog před odesláním) — jde o stejné gramatické pravidlo, ne o dvě různé
 * věci, takže nemá žít duplikované ve dvou souborech.
 */
export function pluralize(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
