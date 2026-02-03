import React, { useState } from 'react';
import './index.css';
import { MODELS, ReplicateService } from './services/replicate';
import { ResearchPanel } from './components/ResearchPanel';
import { TestHistory } from './components/TestHistory';
import { ModelScoreCard } from './components/ModelScoreCard';
import { testDB } from './services/testDatabase';

function App() {
    const [apiKey, setApiKey] = useState(localStorage.getItem('replicate_api_key') || '');
    const [imageUrl, setImageUrl] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [scores, setScores] = useState({});
    const [showScoring, setShowScoring] = useState(false);
    const [hasServerKey, setHasServerKey] = useState(false);
    const [isSaved, setIsSaved] = useState(true);

    // Fetch server API key on mount
    React.useEffect(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(config => {
                if (config.apiKey) {
                    setApiKey(config.apiKey);
                    setHasServerKey(true);
                } else if (!apiKey) {
                    setShowSettings(true);
                }
            })
            .catch(err => {
                console.error('Failed to fetch config:', err);
                if (!apiKey) {
                    setShowSettings(true);
                }
            });
    }, []);

    // Manual Removal State
    const [manualColor, setManualColor] = useState(null);
    const [tolerance, setTolerance] = useState(30);
    const [manualResult, setManualResult] = useState(null);
    const canvasRef = React.useRef(null);

    const hasUnsavedResults = () => {
        return !isSaved && Object.keys(results).some(id => results[id]?.output);
    };

    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check for unsaved data
            if (hasUnsavedResults()) {
                const confirmed = window.confirm(
                    '⚠️ You have unsaved test results!\n\n' +
                    'Uploading a new image will clear your current results. ' +
                    'Make sure to save your test to the database first.\n\n' +
                    'Continue anyway?'
                );
                if (!confirmed) {
                    e.target.value = ''; // Reset file input
                    return;
                }
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result);
                setResults({});
                setScores({});
                setManualResult(null);
                setManualColor(null);
                setIsSaved(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const startComparison = async () => {
        if (!apiKey) {
            setShowSettings(true);
            return;
        }
        if (!imageUrl) return;

        setIsProcessing(true);
        setResults({});
        const service = new ReplicateService(apiKey);

        const promises = MODELS.map(async (model) => {
            try {
                setResults(prev => ({
                    ...prev,
                    [model.id]: { status: 'starting', name: model.name }
                }));

                const prediction = await service.createPrediction(model.id, imageUrl);

                await service.pollPrediction(prediction, (updated) => {
                    setResults(prev => ({
                        ...prev,
                        [model.id]: {
                            ...prev[model.id],
                            status: updated.status,
                            output: updated.output,
                            error: updated.error
                        }
                    }));
                });
            } catch (err) {
                console.error(err);
                setResults(prev => ({
                    ...prev,
                    [model.id]: {
                        ...prev[model.id],
                        status: 'failed',
                        error: err.message
                    }
                }));
            }
        });

        await Promise.all(promises);
        setIsProcessing(false);
        setIsSaved(false); // Mark as unsaved since we have new results
    };

    const downloadImage = async (url, name) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${name.replace(/\s+/g, '_')}_bg_removed.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download failed:', err);
            // Fallback for cross-origin if fetch fails (though proxy should handle it if passed through there, 
            // but here we are downloading directly from the output URL which is usually on replicate or s3)
            window.open(url, '_blank');
        }
    };

    const downloadAll = () => {
        Object.keys(results).forEach(id => {
            const result = results[id];
            if (result.output) {
                const url = Array.isArray(result.output) ? result.output[0] : result.output;
                downloadImage(url, result.name);
            }
        });
    };

    const handlePickColor = (e) => {
        if (!imageUrl) return;
        const img = e.target;
        const rect = img.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
        const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        try {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            setManualColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        } catch (err) {
            console.error('Error picking color:', err);
        }
    };

    const processManualRemoval = () => {
        if (!manualColor || !imageUrl) return;

        const img = new Image();
        img.src = imageUrl;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const { r, g, b } = manualColor;

            for (let i = 0; i < data.length; i += 4) {
                const pr = data[i];
                const pg = data[i + 1];
                const pb = data[i + 2];

                const diff = Math.sqrt(
                    Math.pow(pr - r, 2) +
                    Math.pow(pg - g, 2) +
                    Math.pow(pb - b, 2)
                );

                if (diff < tolerance) {
                    data[i + 3] = 0; // Transparent
                }
            }

            ctx.putImageData(imageData, 0, 0);
            setManualResult(canvas.toDataURL());
        };
    };

    const saveApiKey = (key) => {
        if (!key) return;
        setApiKey(key);
        localStorage.setItem('replicate_api_key', key);
        setShowSettings(false);
    };

    const handleSaveTest = (testData) => {
        testDB.createTest(testData);
        // Clear scores after saving
        setScores({});
        setShowScoring(false);
        setIsSaved(true); // Mark as saved
    };

    const handleScoreChange = (modelId, newScore) => {
        setScores(prev => ({
            ...prev,
            [modelId]: { ...newScore, overall: calculateOverall(newScore) }
        }));
    };

    const calculateOverall = (score) => {
        const metrics = ['edgeAccuracy', 'detailPreservation', 'transparency'];
        const values = metrics.map(m => score[m] || 0).filter(v => v > 0);
        if (values.length === 0) return 0;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };

    return (
        <div className="app-container">
            <header>
                <div className="logo">BG Compare Pro</div>
                <div className="header-buttons">
                    <button className="settings-btn" onClick={() => setShowHistory(true)}>
                        📚 Test Database
                    </button>
                    <button className="settings-btn" onClick={() => setShowSettings(true)}>
                        Settings
                    </button>
                </div>
            </header>

            <main>
                {!imageUrl ? (
                    <label className="upload-section">
                        <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept="image/*" />
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖼️</div>
                        <h2>Drop an image here</h2>
                        <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>or click to browse</p>
                    </label>
                ) : (
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="result-container" style={{ maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                            <img src={imageUrl} alt="Source" className="result-image" />
                            <div className="status-badge status-succeeded" style={{ top: '-10px', right: '-10px' }}>Source</div>
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                            <div className="manual-remover-card">
                                <h3>Manual Color Remover</h3>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                    Click on the image below to pick a color, adjust tolerance, and remove.
                                </p>

                                <div className="manual-flex">
                                    <div className="source-picker-container">
                                        <div className="label-small">Source (Click to Pick)</div>
                                        <img
                                            src={imageUrl}
                                            alt="Source Picker"
                                            className="picker-image"
                                            onClick={handlePickColor}
                                        />
                                    </div>

                                    <div className="manual-controls">
                                        <div className="color-preview-row">
                                            <span>Target Color:</span>
                                            <div
                                                className="color-swatch"
                                                style={{ background: manualColor ? `rgb(${manualColor.r},${manualColor.g},${manualColor.b})` : '#333' }}
                                            ></div>
                                        </div>

                                        <div className="slider-group">
                                            <label>Tolerance ({tolerance})</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="200"
                                                value={tolerance}
                                                onChange={(e) => setTolerance(parseInt(e.target.value))}
                                            />
                                        </div>

                                        <button className="btn-primary" onClick={processManualRemoval} disabled={!manualColor}>
                                            Apply Removal
                                        </button>

                                        {manualResult && (
                                            <button className="settings-btn" onClick={() => downloadImage(manualResult, 'Manual_Removal')}>
                                                Download Manual Result
                                            </button>
                                        )}
                                    </div>

                                    {manualResult && (
                                        <div className="manual-result-preview">
                                            <div className="label-small">Result</div>
                                            <img src={manualResult} alt="Manual Result" className="result-image-small" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="controls" style={{ marginTop: '2rem' }}>
                                <button className="settings-btn" onClick={() => {
                                    if (hasUnsavedResults()) {
                                        const confirmed = window.confirm(
                                            '⚠️ You have unsaved test results!\n\n' +
                                            'Changing the image will clear your current results. ' +
                                            'Make sure to save your test to the database first.\n\n' +
                                            'Continue anyway?'
                                        );
                                        if (!confirmed) return;
                                    }
                                    setImageUrl('');
                                    setManualResult(null);
                                    setManualColor(null);
                                    setResults({});
                                    setScores({});
                                    setIsSaved(true);
                                }}>Change Image</button>
                                <button className="btn-primary" onClick={startComparison} disabled={isProcessing}>
                                    {isProcessing ? 'Processing AI Comparison...' : 'Run AI Comparison'}
                                </button>
                                {Object.values(results).some(r => r.output) && (
                                    <button className="settings-btn" onClick={downloadAll}>Download All</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="model-grid">
                    {MODELS.map(model => (
                        <div key={model.id} className="model-card" style={{ borderTop: `3px solid ${model.color}` }}>
                            <div className="model-name">{model.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                                {model.description}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: model.color, marginBottom: '0.5rem', fontWeight: '500' }}>
                                Best for: {model.bestFor}
                            </div>
                            {results[model.id] && (
                                <div className={`status-badge status-${results[model.id].status}`}>
                                    {results[model.id].status}
                                </div>
                            )}
                            <div className="result-container">
                                {results[model.id]?.output ? (
                                    <>
                                        <img
                                            src={Array.isArray(results[model.id].output) ? results[model.id].output[0] : results[model.id].output}
                                            alt={model.name}
                                            className="result-image"
                                        />
                                        <button
                                            className="download-overlay-btn"
                                            onClick={() => {
                                                const url = Array.isArray(results[model.id].output) ? results[model.id].output[0] : results[model.id].output;
                                                downloadImage(url, model.name);
                                            }}
                                        >
                                            Download
                                        </button>
                                    </>
                                ) : results[model.id]?.status === 'failed' ? (
                                    <div style={{ padding: '1rem', color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
                                        {results[model.id].error}
                                    </div>
                                ) : results[model.id] ? (
                                    <div className="loader"></div>
                                ) : (
                                    <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Waiting...</div>
                                )}
                            </div>

                            <ModelScoreCard
                                modelId={model.id}
                                modelName={model.name}
                                score={scores[model.id]}
                                onScoreChange={handleScoreChange}
                                showScoring={showScoring && results[model.id]?.output}
                            />
                        </div>
                    ))}
                </div>

                {imageUrl && Object.keys(results).length > 0 && (
                    <ResearchPanel
                        onSaveTest={handleSaveTest}
                        scores={scores}
                        results={results}
                        imageUrl={imageUrl}
                        showScoring={showScoring}
                        onToggleScoring={() => setShowScoring(!showScoring)}
                        isSaved={isSaved}
                        replicateApiKey={apiKey}
                    />
                )}
            </main>

            {showSettings && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>API Settings</h3>
                        {hasServerKey ? (
                            <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: '0.5rem 0 1.5rem 0' }}>
                                ✓ Using server-configured API key. You're ready to go!
                            </p>
                        ) : (
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '0.5rem 0 1.5rem 0' }}>
                                Enter your Replicate API key to get started.
                            </p>
                        )}
                        <div className="input-group">
                            <label>Replicate API Token</label>
                            <input
                                id="api-key-input"
                                type="password"
                                defaultValue={apiKey}
                                className="api-input"
                                placeholder="r8_..."
                            />
                        </div>
                        <button
                            className="btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => {
                                const val = document.getElementById('api-key-input').value;
                                saveApiKey(val);
                            }}
                        >
                            Save Key
                        </button>
                        <button
                            className="settings-btn"
                            style={{ width: '100%', marginTop: '0.5rem', background: 'transparent' }}
                            onClick={() => setShowSettings(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showHistory && (
                <TestHistory onClose={() => setShowHistory(false)} />
            )}
        </div>
    );
}

export default App;
