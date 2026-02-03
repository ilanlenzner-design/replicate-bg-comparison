import React, { useState } from 'react';
import { TEST_CATEGORIES } from '../services/testDatabase';

export function ResearchPanel({ onSaveTest, scores, results, imageUrl, showScoring, onToggleScoring, isSaved, replicateApiKey }) {
    const [category, setCategory] = useState('');
    const [testName, setTestName] = useState('');
    const [notes, setNotes] = useState('');
    const [imageAnalysis, setImageAnalysis] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const hasResults = Object.keys(results).some(id => results[id]?.output);
    const hasScores = Object.keys(scores).length > 0;
    const showUnsavedWarning = !isSaved && hasResults;

    const analyzeImage = async () => {
        if (!replicateApiKey) {
            alert('Replicate API key not available. Please enter your API key in settings.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    replicateApiKey
                })
            });

            if (!response.ok) {
                throw new Error('Analysis failed');
            }

            const data = await response.json();
            setImageAnalysis(data.analysis);
        } catch (error) {
            console.error('Image analysis error:', error);
            alert('Failed to analyze image. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = () => {
        if (!category || !testName) {
            alert('Please fill in test category and name');
            return;
        }

        const testData = {
            category,
            name: testName,
            notes,
            imageAnalysis,
            scores,
            results,
            imageUrl
        };

        onSaveTest(testData);

        // Reset form
        setCategory('');
        setTestName('');
        setNotes('');
        setImageAnalysis('');

        alert('Test saved successfully!');
    };

    return (
        <div className="research-panel">
            <div className="research-header">
                <h3>📊 Research Panel</h3>
                <button
                    className="btn-toggle"
                    onClick={onToggleScoring}
                    disabled={!hasResults}
                >
                    {showScoring ? 'Hide Scoring' : 'Show Scoring'}
                </button>
            </div>

            {showUnsavedWarning && (
                <div className="unsaved-warning">
                    ⚠️ <strong>Unsaved Results!</strong> Make sure to save this test to the database before uploading a new image or closing the page.
                </div>
            )}

            <div className="research-content">
                {/* Test Metadata */}
                <div className="metadata-section">
                    <div className="input-group">
                        <label>Test Category *</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="category-select"
                        >
                            <option value="">Select category...</option>
                            {TEST_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Test Name *</label>
                        <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            placeholder="e.g., UFO with green screen"
                            className="text-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observations, edge cases, recommendations..."
                            className="text-area"
                            rows="3"
                        />
                    </div>
                </div>

                {/* AI Image Analysis */}
                {imageUrl && replicateApiKey && (
                    <div className="analysis-section">
                        <div className="analysis-header">
                            <label>🤖 AI Image Analysis</label>
                            <button
                                className="btn-analyze"
                                onClick={analyzeImage}
                                disabled={isAnalyzing}
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                            </button>
                        </div>
                        {imageAnalysis && (
                            <textarea
                                value={imageAnalysis}
                                onChange={(e) => setImageAnalysis(e.target.value)}
                                className="analysis-text"
                                rows="6"
                                placeholder="AI analysis will appear here..."
                            />
                        )}
                        <p className="analysis-hint">
                            AI analyzes subject, style, challenges - helps build recommendation engine later
                        </p>
                    </div>
                )}

                {/* Scoring Instructions */}
                {showScoring && hasResults && (
                    <div className="scoring-info">
                        <p>⬆️ Use the scoring controls under each result image above</p>
                    </div>
                )}

                {/* Save Button */}
                <button
                    className="btn-save-test"
                    onClick={handleSave}
                    disabled={!category || !testName || !hasResults}
                >
                    💾 Save Test to Database
                    {hasScores && <span className="score-count">({Object.keys(scores).length} models scored)</span>}
                </button>

                {!hasResults && (
                    <p className="hint-text">Run a comparison first to save test results</p>
                )}
            </div>

            <style jsx>{`
                .research-panel {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                    border: 2px solid var(--border);
                }

                .research-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .research-header h3 {
                    margin: 0;
                    font-size: 1.2rem;
                }

                .btn-toggle {
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: opacity 0.2s;
                }

                .btn-toggle:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .unsaved-warning {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.1));
                    border: 2px solid #f59e0b;
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 1rem 0;
                    color: #fbbf24;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    animation: pulse 2s ease-in-out infinite;
                }

                .unsaved-warning strong {
                    color: #fbbf24;
                }

                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }

                .metadata-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .analysis-section {
                    background: rgba(56, 189, 248, 0.05);
                    border: 1px solid rgba(56, 189, 248, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }

                .analysis-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .analysis-header label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--accent);
                }

                .btn-analyze {
                    padding: 0.5rem 1rem;
                    background: var(--accent);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }

                .btn-analyze:hover:not(:disabled) {
                    opacity: 0.9;
                }

                .btn-analyze:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .analysis-text {
                    width: 100%;
                    padding: 0.75rem;
                    border-radius: 6px;
                    border: 1px solid var(--border);
                    background: var(--bg);
                    color: var(--text);
                    font-size: 0.85rem;
                    font-family: inherit;
                    resize: vertical;
                    line-height: 1.5;
                }

                .analysis-hint {
                    margin: 0.5rem 0 0 0;
                    font-size: 0.75rem;
                    color: var(--text-dim);
                    font-style: italic;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .input-group label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text);
                }

                .category-select, .text-input {
                    padding: 0.75rem;
                    border-radius: 6px;
                    border: 1px solid var(--border);
                    background: var(--bg);
                    color: var(--text);
                    font-size: 0.9rem;
                }

                .text-area {
                    padding: 0.75rem;
                    border-radius: 6px;
                    border: 1px solid var(--border);
                    background: var(--bg);
                    color: var(--text);
                    font-size: 0.9rem;
                    font-family: inherit;
                    resize: vertical;
                }

                .scoring-info {
                    background: rgba(56, 189, 248, 0.1);
                    border: 1px solid var(--accent);
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    text-align: center;
                }

                .scoring-info p {
                    margin: 0;
                    color: var(--accent);
                    font-size: 0.9rem;
                }

                .btn-save-test {
                    width: 100%;
                    padding: 1rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }

                .btn-save-test:hover:not(:disabled) {
                    transform: translateY(-2px);
                }

                .btn-save-test:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .score-count {
                    font-size: 0.85rem;
                    opacity: 0.9;
                }

                .hint-text {
                    text-align: center;
                    color: var(--text-dim);
                    font-size: 0.85rem;
                    margin-top: 0.5rem;
                }
            `}</style>
        </div>
    );
}
