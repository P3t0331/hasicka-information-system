import React from 'react';

// Row style shared by the single/multi option lists — a label wrapping the
// input so tapping the text also toggles the choice (matters on a phone).
const optionRowStyle = {
  display: 'flex', alignItems: 'center', gap: '0.6rem',
  padding: '0.5rem 0.65rem', borderRadius: '8px', cursor: 'pointer',
};

// Options must render in the shuffle order recorded on the attempt
// (`order.optionOrder[question.id]`), not the quiz document's order — the
// document order is only the authoring order and ignoring the shuffle here
// would silently defeat the "shuffle options" setting. `order` can be
// missing defensively (should not happen for a real attempt); unknown ids
// referenced by the question but absent from the recorded order (should
// likewise not happen) are appended at the end rather than dropped, so an
// option is never rendered as unanswerable.
function orderedOptions(question, order) {
  const options = question.options || [];
  const optionOrder = order?.optionOrder?.[question.id];
  if (!optionOrder) return options;
  const byId = new Map(options.map(o => [o.id, o]));
  const ordered = optionOrder.map(id => byId.get(id)).filter(Boolean);
  const seen = new Set(optionOrder);
  const leftover = options.filter(o => !seen.has(o.id));
  return [...ordered, ...leftover];
}

/**
 * Renders one quiz question, controlled by `value`/`onChange` — no state of
 * its own. `value` shape mirrors what the server's grader in
 * `shared/quizScoring.js` expects, so it must match exactly:
 *  - single -> [optionId]            (array of exactly one id)
 *  - multi  -> [optionId, ...]
 *  - boolean -> true | false         (a real boolean, not an array)
 *  - text   -> string
 */
export default function QuestionRenderer({ question, order, value, onChange, disabled }) {
  const options = orderedOptions(question, order);

  if (question.type === 'single') {
    const selected = Array.isArray(value) ? value[0] : undefined;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {options.map(option => (
          <label key={option.id} style={optionRowStyle} className="quiz-option-row">
            <input
              type="radio"
              name={`question-${question.id}`}
              checked={selected === option.id}
              disabled={disabled}
              onChange={() => onChange([option.id])}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'multi') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {options.map(option => {
          const checked = selected.includes(option.id);
          return (
            <label key={option.id} style={optionRowStyle} className="quiz-option-row">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  const next = checked
                    ? selected.filter(id => id !== option.id)
                    : [...selected, option.id];
                  onChange(next);
                }}
              />
              <span>{option.text}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          type="button"
          className={`btn ${value === true ? 'btn-primary' : 'btn-secondary'}`}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          Ano
        </button>
        <button
          type="button"
          className={`btn ${value === false ? 'btn-primary' : 'btn-secondary'}`}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          Ne
        </button>
      </div>
    );
  }

  // 'text'
  return (
    <textarea
      className="input-field"
      rows={4}
      style={{ resize: 'vertical', width: '100%' }}
      value={typeof value === 'string' ? value : ''}
      disabled={disabled}
      placeholder="Vaše odpověď…"
      onChange={e => onChange(e.target.value)}
    />
  );
}
