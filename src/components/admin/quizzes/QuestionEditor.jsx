/* eslint-disable react-refresh/only-export-components */
import React from 'react';

// Id generator for questions and options. Once generated, an id is
// immutable — the answer key and every stored attempt reference it.
// Regenerating an id silently orphans the correct answer.
export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyQuestion(type = 'single') {
  const base = { id: newId(), type, text: '', options: [] };
  if (type === 'single' || type === 'multi') {
    base.options = [{ id: newId(), text: '' }, { id: newId(), text: '' }];
  }
  return base;
}

const TYPE_LABELS = {
  single: 'Jedna správná odpověď',
  multi: 'Více správných odpovědí',
  boolean: 'Ano / Ne',
  text: 'Otevřená odpověď',
};

const iconButtonStyle = { padding: '0.25rem 0.55rem', fontSize: '0.85rem', lineHeight: 1 };

/**
 * Editor for a single quiz question. Fully controlled — holds no state of
 * its own, reports every change upward through its callbacks. The question
 * text/type/options go through `onChange` (they belong to the `quizzes`
 * document); the correct answer goes through `onKeyChange` and the
 * explanation through `onExplanationChange` (both belong to the
 * `quizAnswerKeys` document, which members never read).
 */
export default function QuestionEditor({
  question,
  index,
  keyEntry,
  explanation,
  onChange,
  onKeyChange,
  onExplanationChange,
  onMove,
  onDuplicate,
  onRemove,
  disabled,
  isFirst,
  isLast,
}) {
  const options = question.options || [];
  const correct = keyEntry?.correct;

  function handleTypeChange(e) {
    const type = e.target.value;
    const patch = { type };
    patch.options = (type === 'single' || type === 'multi')
      ? [{ id: newId(), text: '' }, { id: newId(), text: '' }]
      : [];
    onChange(patch);
  }

  function handleOptionText(optionId, text) {
    onChange({ options: options.map(o => (o.id === optionId ? { ...o, text } : o)) });
  }

  function handleAddOption() {
    onChange({ options: [...options, { id: newId(), text: '' }] });
  }

  function handleRemoveOption(optionId) {
    onChange({ options: options.filter(o => o.id !== optionId) });
    if (Array.isArray(correct) && correct.includes(optionId)) {
      onKeyChange(correct.filter(id => id !== optionId));
    }
  }

  function handleSingleCorrect(optionId) {
    onKeyChange([optionId]);
  }

  function handleMultiToggle(optionId) {
    const current = Array.isArray(correct) ? correct : [];
    const next = current.includes(optionId)
      ? current.filter(id => id !== optionId)
      : [...current, optionId];
    onKeyChange(next);
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap',
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Otázka {index + 1}</h3>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={iconButtonStyle}
            title="Posunout nahoru"
            aria-label="Posunout otázku nahoru"
            disabled={disabled || isFirst}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={iconButtonStyle}
            title="Posunout dolů"
            aria-label="Posunout otázku dolů"
            disabled={disabled || isLast}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={iconButtonStyle}
            title="Duplikovat otázku"
            aria-label="Duplikovat otázku"
            disabled={disabled}
            onClick={onDuplicate}
          >
            ⧉
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ ...iconButtonStyle, color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
            title="Smazat otázku"
            aria-label="Smazat otázku"
            disabled={disabled}
            onClick={onRemove}
          >
            🗑
          </button>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Typ otázky</label>
        <select className="input-field" value={question.type} disabled={disabled} onChange={handleTypeChange}>
          <option value="single">{TYPE_LABELS.single}</option>
          <option value="multi">{TYPE_LABELS.multi}</option>
          <option value="boolean">{TYPE_LABELS.boolean}</option>
          <option value="text">{TYPE_LABELS.text}</option>
        </select>
      </div>

      <div className="input-group">
        <label className="input-label">Znění otázky</label>
        <textarea
          className="input-field"
          rows={2}
          style={{ resize: 'vertical' }}
          value={question.text || ''}
          disabled={disabled}
          onChange={e => onChange({ text: e.target.value })}
        />
      </div>

      {(question.type === 'single' || question.type === 'multi') && (
        <div className="input-group">
          <label className="input-label">Volby</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {options.map(option => (
              <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type={question.type === 'single' ? 'radio' : 'checkbox'}
                  name={`correct-${question.id}`}
                  checked={question.type === 'single'
                    ? correct?.[0] === option.id
                    : Array.isArray(correct) && correct.includes(option.id)}
                  disabled={disabled}
                  onChange={() => (question.type === 'single'
                    ? handleSingleCorrect(option.id)
                    : handleMultiToggle(option.id))}
                />
                <input
                  className="input-field"
                  style={{ flex: 1 }}
                  value={option.text || ''}
                  disabled={disabled}
                  placeholder="Znění volby"
                  onChange={e => handleOptionText(option.id, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                    disabled={disabled}
                    title="Odebrat volbu"
                    aria-label="Odebrat volbu"
                    onClick={() => handleRemoveOption(option.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
            disabled={disabled}
            onClick={handleAddOption}
          >
            + Přidat volbu
          </button>
        </div>
      )}

      {question.type === 'boolean' && (
        <div className="input-group">
          <label className="input-label">Správná odpověď</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn ${correct === true ? 'btn-primary' : 'btn-secondary'}`}
              disabled={disabled}
              onClick={() => onKeyChange(true)}
            >
              Ano
            </button>
            <button
              type="button"
              className={`btn ${correct === false ? 'btn-primary' : 'btn-secondary'}`}
              disabled={disabled}
              onClick={() => onKeyChange(false)}
            >
              Ne
            </button>
          </div>
        </div>
      )}

      {question.type === 'text' && (
        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
          Otevřenou odpověď vyhodnotíte ručně po odevzdání.
        </p>
      )}

      <div className="input-group" style={{ marginBottom: 0 }}>
        <label className="input-label">Vysvětlení (nepovinné)</label>
        <textarea
          className="input-field"
          rows={2}
          style={{ resize: 'vertical' }}
          value={explanation || ''}
          disabled={disabled}
          placeholder="Zobrazí se členovi po odeslání, pokud kvíz ukazuje správné odpovědi."
          onChange={e => onExplanationChange(e.target.value)}
        />
      </div>
    </div>
  );
}
