import { useState } from 'react';
import useSuggestions from '../hooks/useSuggestions';
import SuggestionCard from '../components/suggestions/SuggestionCard';
import CreateSuggestionModal from '../components/suggestions/CreateSuggestionModal';
import { useAuth } from '../contexts/AuthContext';

export default function SuggestionsPage() {
    const { currentUser } = useAuth();
    const { suggestions, loading, createSuggestion, vote, deleteSuggestion } = useSuggestions();
    const [showCreateModal, setShowCreateModal] = useState(false);

    return (
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
            {showCreateModal && (
                <CreateSuggestionModal
                    onSubmit={createSuggestion}
                    onClose={() => setShowCreateModal(false)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.9rem' }}>💡 Návrhy a podněty</h1>
                    <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
                        Navrhněte zlepšení a hlasujte pro nápady ostatních
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Nový návrh
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Načítání...</div>
            ) : suggestions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💡</div>
                    <p style={{ margin: 0 }}>Zatím žádné návrhy. Buďte první!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {suggestions.map(s => (
                        <SuggestionCard
                            key={s.id}
                            suggestion={s}
                            currentUser={currentUser}
                            isAdmin={false}
                            onVote={vote}
                            onDelete={deleteSuggestion}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
