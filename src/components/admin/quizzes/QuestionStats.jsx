import React, { useMemo } from 'react';
import { isAnswerCorrect } from '../../../../shared/quizScoring.js';

// Barvy podle stejné konvence jako zbytek admin UI (viz QuizResultsTable/
// QuizAttemptDetail): zelená nad 80 %, oranžová 50–80 %, červená pod 50 %.
// Šedá je zvláštní stav mimo tuhle stupnici — otázka, o které zatím nevíme
// nic (viz `percent === null` níže), ne nejhorší otázka v kvízu.
const UNDECIDED_COLORS = { color: '#616161', bg: '#F5F5F5', border: '#BDBDBD' };

function colorFor(percent) {
    if (percent >= 80) return { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' };
    if (percent >= 50) return { color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' };
    return { color: '#C62828', bg: '#FFEBEE', border: '#FFCDD2' };
}

// Pro každou otázku spočítá, kolik odevzdaných pokusů ji mělo správně/špatně.
//
// Volbové a ano/ne otázky: `isAnswerCorrect` vrací true/false podle klíče —
// nezodpovězená otázka (answer === undefined) v něm přirozeně vyjde jako
// false (špatně), protože prázdný výběr se neshoduje se správnou odpovědí.
// Žádný speciální případ pro "nezodpovězeno" tu proto není potřeba.
//
// Textové otázky: jediný zdroj pravdy je `manualGrades[questionId]`. Pokud
// tam hodnota chybí, pokus je sice odevzdaný, ale otázka ještě není
// ohodnocená — to NENÍ "špatně", je to "zatím nerozhodnuto", a tak se do
// součtu vůbec nepočítá (ani do jmenovatele). Kdyby se počítala do
// jmenovatele bez připočtení ke správným, procento by ji fakticky trestalo
// jako špatnou odpověď dřív, než ji velitel vůbec uviděl.
//
// `isAnswerCorrect` vrací null i defenzivně pro volbovou/ano-ne otázku bez
// klíče nebo s `autoGraded: false` (v aktuální aplikaci se nevytváří, ale
// funkce to obecně umožňuje) — takový případ se řeší stejně jako
// nehodnocená textová otázka: nerozhodnuto, nepočítá se.
function computeQuestionStats(quiz, answerKey, attempts) {
    const questions = quiz?.questions || [];
    const keyAnswers = answerKey?.answers || {};
    const submitted = (attempts || []).filter(a => a.status !== 'in_progress');

    return questions.map((question, index) => {
        const keyEntry = keyAnswers[question.id];
        let correct = 0;
        let wrong = 0;

        submitted.forEach((attempt) => {
            let result;
            if (question.type === 'text') {
                const grade = attempt.manualGrades?.[question.id];
                if (grade === undefined) return; // zatím nehodnoceno — nepočítá se
                result = grade === 1;
            } else {
                const auto = isAnswerCorrect(question, keyEntry, attempt.answers?.[question.id]);
                if (auto === null) return; // nerozhodnuto (viz komentář výše)
                result = auto;
            }
            if (result) correct += 1; else wrong += 1;
        });

        const answered = correct + wrong;
        const percent = answered > 0 ? Math.round((correct / answered) * 100) : null;

        return {
            questionId: question.id,
            number: index + 1,
            text: question.text,
            type: question.type,
            answered,
            correct,
            percent,
        };
    });
}

// Nejhorší otázka nahoře. Otázky bez rozhodnutého výsledku (percent === null
// — typicky nehodnocená textová otázka) jdou na konec: nejde o "nejlepší"
// ani "nejhorší" otázku, jen o otázku, o které se zatím nedá nic říct.
function sortByPercentAscending(stats) {
    return [...stats].sort((a, b) => {
        if (a.percent === null && b.percent === null) return a.number - b.number;
        if (a.percent === null) return 1;
        if (b.percent === null) return -1;
        return a.percent - b.percent;
    });
}

/**
 * Statistika úspěšnosti jednotlivých otázek kvízu (úloha 16) — druhý pohled
 * na stejná data jako `QuizResultsTable`/`QuizAttemptDetail` (úlohy 14/15),
 * tentokrát seskupená podle otázky místo podle člena. Ukazuje veliteli, které
 * téma je potřeba na příštím školení zopakovat.
 */
export default function QuestionStats({ quiz, answerKey, attempts }) {
    const stats = useMemo(
        () => sortByPercentAscending(computeQuestionStats(quiz, answerKey, attempts)),
        [quiz, answerKey, attempts],
    );

    const hasSubmitted = (attempts || []).some(a => a.status !== 'in_progress');

    if (!hasSubmitted) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0 }}>Zatím nikdo kvíz neodevzdal.</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats.map((s) => {
                    const undecided = s.percent === null;
                    const cfg = undecided ? UNDECIDED_COLORS : colorFor(s.percent);
                    return (
                        <div key={s.questionId} className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: `4px solid ${cfg.color}` }}>
                            <p style={{ margin: '0 0 0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {s.number}. {s.text}
                            </p>

                            <div style={{
                                height: '10px', borderRadius: '999px', background: '#eee', overflow: 'hidden', marginBottom: '0.5rem',
                            }}>
                                <div style={{
                                    height: '100%', width: `${undecided ? 0 : s.percent}%`,
                                    background: cfg.color, borderRadius: '999px',
                                }} />
                            </div>

                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: cfg.color }}>
                                {undecided
                                    ? 'Zatím nehodnoceno'
                                    : `${s.correct} z ${s.answered} správně (${s.percent} %)`}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Statistika počítá jen odevzdané pokusy.
            </p>
        </div>
    );
}
