import React, { useState } from 'react';
import ReorderEquipmentTypesModal from './modals/ReorderEquipmentTypesModal';

export default function EquipmentTypesTab({
  equipmentTypes,
  onAddClick,
  onEditClick,
  onRemoveClick,
  onReorderSave
}) {
  const [showReorder, setShowReorder] = useState(false);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Druhy vybavení</h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Definujte typy vybavení, které mohou členové evidovat na svém profilu.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {equipmentTypes.length > 1 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
              onClick={() => setShowReorder(true)}
            >
              🔀 Změnit pořadí
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
            onClick={onAddClick}
          >
            + Přidat
          </button>
        </div>
      </div>

      {equipmentTypes.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '1rem 0 0' }}>
          Zatím nejsou definovány žádné druhy. Členové si nemohou evidovat vybavení.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Název typu</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sledované údaje</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {equipmentTypes.map((eq, i) => {
                const tracked = [];
                if (eq.hasBrand) tracked.push('Značka');
                if (eq.hasSize) tracked.push('Velikost');
                if (eq.hasAmount) tracked.push('Počet');
                if (eq.hasInventoryNumber) tracked.push('Evid. číslo');
                if (eq.hasSerialNumber) tracked.push('Výrobní číslo');
                if (eq.hasManufactureYear) tracked.push('Rok výroby');
                if (eq.hasIssueYear) tracked.push('Rok nafasování');
                if (eq.hasWear) tracked.push('Stav opotřebení');
                if (eq.hasPolep) tracked.push('Polep');

                return (
                  <tr key={eq.id} style={{ borderBottom: '1px solid var(--surface-hover)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-sunken)' }}>
                    <td data-label="Název" style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--text-charcoal)' }}>{eq.name}</td>
                    <td data-label="Sledované údaje" style={{ padding: '0.6rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {tracked.length > 0 ? tracked.map(t => (
                          <span key={t} style={{ background: 'var(--info-bg)', color: 'var(--info-text)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--info-border)' }}>{t}</span>
                        )) : <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', fontStyle: 'italic' }}>Žádné dodatečné pole</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => onEditClick(eq)}
                          style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem 0.4rem', borderRadius: '4px' }}
                          title="Upravit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onRemoveClick(eq.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem 0.4rem', borderRadius: '4px' }}
                          title="Smazat"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showReorder && (
        <ReorderEquipmentTypesModal
          equipmentTypes={equipmentTypes}
          onClose={() => setShowReorder(false)}
          onSave={(newTypes) => {
            onReorderSave(newTypes);
            setShowReorder(false);
          }}
        />
      )}
    </div>
  );
}
