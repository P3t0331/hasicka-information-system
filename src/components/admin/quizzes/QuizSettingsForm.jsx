import React from 'react';
import { ROLE_OPTIONS } from '../constants';

function formatTrainingDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

// `disabled` locks only the fields that freeze once a quiz is published
// (training link, pass threshold, attempts, time limit, shuffle flags) —
// title/description/deadline/assignment/post-submit toggles stay editable
// while merely published, by design. `readOnly` is stronger: the whole
// quiz is frozen (closed), so every field here must be genuinely disabled,
// including the ones `disabled` alone never touches.
export default function QuizSettingsForm({ quiz, onChange, disabled, readOnly, trainings }) {
  const assignment = quiz.assignment || { mode: 'all', roles: [] };
  const publishLocked = readOnly || disabled;

  function handleTrainingChange(e) {
    const value = e.target.value || null;
    const patch = { trainingId: value };
    if (!value && assignment.mode === 'training') {
      patch.assignment = { ...assignment, mode: 'all' };
    }
    onChange(patch);
  }

  function handleModeChange(e) {
    onChange({ assignment: { ...assignment, mode: e.target.value } });
  }

  function toggleRole(role) {
    const current = assignment.roles || [];
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    onChange({ assignment: { ...assignment, roles: next } });
  }

  return (
    <div>
      <div className="input-group">
        <label className="input-label">Název</label>
        <input
          className="input-field"
          value={quiz.title || ''}
          disabled={readOnly}
          onChange={e => onChange({ title: e.target.value })}
        />
      </div>

      <div className="input-group">
        <label className="input-label">Popis</label>
        <textarea
          className="input-field"
          rows={3}
          style={{ resize: 'vertical' }}
          value={quiz.description || ''}
          disabled={readOnly}
          onChange={e => onChange({ description: e.target.value })}
        />
      </div>

      <div className="input-group">
        <label className="input-label">Navázané školení</label>
        <select
          className="input-field"
          value={quiz.trainingId || ''}
          disabled={publishLocked}
          onChange={handleTrainingChange}
        >
          <option value="">— žádné —</option>
          {trainings.map(t => (
            <option key={t.id} value={t.id}>
              {t.title}{t.date ? ` — ${formatTrainingDate(t.date)}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label">Přiřazení</label>
          <select className="input-field" value={assignment.mode || 'all'} disabled={readOnly} onChange={handleModeChange}>
            <option value="all">Všichni aktivní členové</option>
            <option value="roles">Vybrané role</option>
            {quiz.trainingId && <option value="training">Účastníci školení</option>}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Termín</label>
          <input
            className="input-field"
            type="date"
            value={quiz.deadline || ''}
            disabled={readOnly}
            onChange={e => onChange({ deadline: e.target.value })}
          />
        </div>
      </div>

      {assignment.mode === 'roles' && (
        <div className="input-group">
          <label className="input-label">Role</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {ROLE_OPTIONS.map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: readOnly ? 'default' : 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={(assignment.roles || []).includes(role)}
                  disabled={readOnly}
                  onChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="input-group">
          <label className="input-label">Hranice úspěšnosti</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              className="input-field"
              type="number"
              min={1}
              max={100}
              disabled={publishLocked}
              value={quiz.passThreshold ?? ''}
              onChange={e => onChange({ passThreshold: parseInt(e.target.value, 10) || 0 })}
            />
            <span className="text-secondary">%</span>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Počet pokusů</label>
          <input
            className="input-field"
            type="number"
            min={0}
            max={20}
            disabled={publishLocked}
            value={quiz.maxAttempts ?? ''}
            onChange={e => onChange({ maxAttempts: parseInt(e.target.value, 10) || 0 })}
          />
          <span className="text-secondary" style={{ fontSize: '0.8rem' }}>0 = neomezeně</span>
        </div>

        <div className="input-group">
          <label className="input-label">Časový limit (min)</label>
          <input
            className="input-field"
            type="number"
            min={1}
            disabled={publishLocked}
            value={quiz.timeLimitMinutes ?? ''}
            placeholder="Bez limitu"
            onChange={e => {
              const raw = e.target.value;
              onChange({ timeLimitMinutes: raw === '' ? null : (parseInt(raw, 10) || null) });
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: publishLocked ? 'default' : 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={!!quiz.shuffleQuestions}
            disabled={publishLocked}
            onChange={e => onChange({ shuffleQuestions: e.target.checked })}
          />
          Zamíchat otázky
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: publishLocked ? 'default' : 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={!!quiz.shuffleOptions}
            disabled={publishLocked}
            onChange={e => onChange({ shuffleOptions: e.target.checked })}
          />
          Zamíchat volby
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: readOnly ? 'default' : 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={!!quiz.showCorrectAnswers}
            disabled={readOnly}
            onChange={e => onChange({ showCorrectAnswers: e.target.checked })}
          />
          Zobrazit správné odpovědi po odeslání
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: readOnly ? 'default' : 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={!!quiz.notifyOnPublish}
            disabled={readOnly}
            onChange={e => onChange({ notifyOnPublish: e.target.checked })}
          />
          Upozornit členy při zveřejnění
        </label>
      </div>
    </div>
  );
}
