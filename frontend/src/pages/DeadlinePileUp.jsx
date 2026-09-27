import { useState, useMemo } from 'react';
import { extractDeadlinesFromAnnouncements } from '../services/aiService';
import { detectDeadlineClusters, formatDateISO } from '../utils/deadlineEngine';
import { Button, Badge } from '../components/ui';
import './DeadlinePileUp.css';

// Preset sample announcements for quick testing of all edge cases & cluster rules
const SAMPLE_PRESETS = {
  ambiguousCluster: [
    'DBMS Assignment 2 is due next Friday. Submit the ER diagram and SQL queries through the portal.',
    'Operating Systems lab report must be submitted on 10/11.',
    'Artificial Intelligence final project submission is due October 15.',
    'Networks assignment is due October 20, 2026. Final submission deadline: October 22, 2026.',
    'Web Development assignment 1 is due October 10, 2026 at 10:00 AM.',
    'Software Engineering report due October 11, 2026 at 10:00 AM.',
  ],
  exact48hCluster: [
    'DBMS Assignment due October 10, 2026 at 10:00 AM.',
    'OS Lab Report due October 11, 2026 at 10:00 AM.',
    'AI Project due October 12, 2026 at 10:00 AM.',
    'Networks Lab due October 25, 2026.',
    'Web Dev Assignment due November 02, 2026.',
    'Software Engineering Report due November 15, 2026.',
  ],
  exact49hNoCluster: [
    'DBMS Assignment due October 10, 2026 at 10:00 AM.',
    'OS Lab Report due October 11, 2026 at 10:00 AM.',
    'AI Project due October 12, 2026 at 11:00 AM.',
    'Networks Lab due October 25, 2026.',
    'Web Dev Assignment due November 02, 2026.',
    'Software Engineering Report due November 15, 2026.',
  ],
  noCluster6: [
    'DBMS Assignment due October 01, 2026.',
    'OS Lab Report due October 08, 2026.',
    'AI Project due October 16, 2026.',
    'Networks Lab due October 24, 2026.',
    'Web Dev Assignment due November 02, 2026.',
    'Software Engineering Report due November 10, 2026.',
  ],
};

export default function DeadlinePileUp() {
  const [announcements, setAnnouncements] = useState(SAMPLE_PRESETS.ambiguousCluster);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Input change handler
  const handleAnnouncementChange = (index, value) => {
    const updated = [...announcements];
    updated[index] = value;
    setAnnouncements(updated);
  };

  // Load preset handler
  const loadPreset = (presetKey) => {
    if (SAMPLE_PRESETS[presetKey]) {
      setAnnouncements(SAMPLE_PRESETS[presetKey]);
      setExtractedItems([]);
    }
  };

  const clearAllInputs = () => {
    setAnnouncements(['', '', '', '', '', '']);
    setExtractedItems([]);
  };

  // Step 2: Extraction Trigger
  const handleExtractDeadlines = async () => {
    setExtracting(true);
    try {
      const results = await extractDeadlinesFromAnnouncements(announcements);
      setExtractedItems(results);
    } catch (err) {
      console.error('Extraction failed:', err);
    } finally {
      setExtracting(false);
    }
  };

  // Confirm / Verify item handler
  const handleConfirmItem = (id, overrideFields = {}) => {
    setExtractedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            ...overrideFields,
            status: 'verified',
            message: null,
          };
        }
        return item;
      })
    );
  };

  // Start editing handler
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditFormData({
      title: item.title,
      subject: item.subject,
      deadlineDate: item.deadlineDate || formatDateISO(new Date()),
      deadlineTime: item.deadlineTime || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const saveEdit = (id) => {
    setExtractedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const hasTime = !!editFormData.deadlineTime;
          return {
            ...item,
            title: editFormData.title || item.title,
            subject: editFormData.subject || item.subject,
            deadlineDate: editFormData.deadlineDate,
            deadlineTime: editFormData.deadlineTime || null,
            hasExplicitTime: hasTime,
            status: 'verified',
            message: null,
          };
        }
        return item;
      })
    );
    setEditingId(null);
  };

  // Calculate sorted verified items & exact 48h clusters using code
  const clusterResults = useMemo(() => {
    return detectDeadlineClusters(extractedItems);
  }, [extractedItems]);

  const verifiedCount = extractedItems.filter((i) => i.status === 'verified').length;

  return (
    <div className="pileup-page">
      {/* Header Banner */}
      <header className="pileup-header">
        <div className="pileup-header-title">
          <h1>🔥 Deadline Pile-Up Detector</h1>
          <p className="pileup-subtitle">
            Extract deadlines from 6 messy announcements, verify ambiguous dates, and highlight crowded 48-hour submission windows.
          </p>
        </div>
      </header>

      {/* Preset Quick Loader Controls */}
      <section className="pileup-presets-card">
        <span className="presets-label">⚡ Quick Test Presets:</span>
        <div className="presets-buttons">
          <Button variant="secondary" size="sm" onClick={() => loadPreset('ambiguousCluster')}>
            Ambiguity & Cluster Demo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => loadPreset('exact48hCluster')}>
            Exact 48h Cluster (Oct 10,11,12)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => loadPreset('exact49hNoCluster')}>
            49h Case (No Cluster)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => loadPreset('noCluster6')}>
            6 Deadlines (No Cluster)
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAllInputs}>
            🗑️ Clear All
          </Button>
        </div>
      </section>

      {/* STEP 1: Input Announcements */}
      <section className="pileup-step-section">
        <div className="step-header">
          <span className="step-number">STEP 1</span>
          <h2>Paste 6 Announcements</h2>
        </div>
        <p className="step-desc">
          Provide exactly 6 course announcements or assignment briefs containing natural language, relative dates, or messy wording.
        </p>

        <div className="announcements-grid">
          {announcements.map((text, idx) => (
            <div key={idx} className="announcement-input-card">
              <label className="announcement-label">
                <span>Announcement #{idx + 1}</span>
                {text.trim() ? (
                  <Badge variant="accent" size="sm">Ready</Badge>
                ) : (
                  <Badge variant="ghost" size="sm">Empty</Badge>
                )}
              </label>
              <textarea
                className="announcement-textarea"
                rows={3}
                placeholder={`e.g. DBMS Assignment ${idx + 1} is due next Friday...`}
                value={text}
                onChange={(e) => handleAnnouncementChange(idx, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* STEP 2 Action Button */}
        <div className="pileup-action-bar">
          <Button
            variant="primary"
            size="lg"
            onClick={handleExtractDeadlines}
            disabled={extracting || announcements.every((a) => !a.trim())}
          >
            {extracting ? '⏳ AI Extracting Deadlines...' : '🤖 Extract Deadlines'}
          </Button>
        </div>
      </section>

      {/* STEP 3 & 4: Editable Deadline List & Verification */}
      {extractedItems.length > 0 && (
        <section className="pileup-step-section">
          <div className="step-header-row">
            <div className="step-header">
              <span className="step-number">STEP 3 & 4</span>
              <h2>Verify & Edit Extracted Deadlines</h2>
            </div>
            <div className="verification-summary-badge">
              <span>{verifiedCount} / {extractedItems.length} Verified</span>
            </div>
          </div>
          <p className="step-desc">
            Review the extracted details and supporting original source snippets. Confirm ambiguous dates or edit fields before conflict analysis.
          </p>

          <div className="deadline-items-list">
            {extractedItems.map((item) => {
              const isEditing = editingId === item.id;
              const isClustered = clusterResults.clusteredItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`deadline-card ${
                    item.status === 'verified'
                      ? 'deadline-card--verified'
                      : item.status === 'conflicting'
                      ? 'deadline-card--conflicting'
                      : 'deadline-card--needs-verification'
                  } ${isClustered ? 'deadline-card--clustered' : ''}`}
                >
                  {/* Card Top Row */}
                  <div className="deadline-card-header">
                    <div className="deadline-card-title-group">
                      <span className="announcement-badge">
                        #{item.announcementIndex + 1}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          className="edit-input edit-input--title"
                          value={editFormData.title}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, title: e.target.value })
                          }
                          placeholder="Assignment Title"
                        />
                      ) : (
                        <h3 className="deadline-card-title">{item.title}</h3>
                      )}
                    </div>

                    <div className="deadline-card-status">
                      {isClustered && (
                        <Badge variant="danger" size="sm" className="clustered-tag">
                          ⚠ Crowded Period
                        </Badge>
                      )}
                      {item.status === 'verified' && (
                        <Badge variant="accent" size="sm">✓ Verified</Badge>
                      )}
                      {item.status === 'needs_verification' && (
                        <Badge variant="warning" size="sm">⚠ Needs verification</Badge>
                      )}
                      {item.status === 'conflicting' && (
                        <Badge variant="danger" size="sm">⚠ Conflicting</Badge>
                      )}
                    </div>
                  </div>

                  {/* Subject & Deadline Details */}
                  <div className="deadline-card-details">
                    <div className="detail-row">
                      <span className="detail-label">Subject:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          className="edit-input"
                          value={editFormData.subject}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, subject: e.target.value })
                          }
                          placeholder="Subject"
                        />
                      ) : (
                        <span className="detail-value">{item.subject}</span>
                      )}
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Deadline:</span>
                      {isEditing ? (
                        <div className="edit-date-group">
                          <input
                            type="date"
                            className="edit-input"
                            value={editFormData.deadlineDate}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, deadlineDate: e.target.value })
                            }
                          />
                          <input
                            type="time"
                            className="edit-input edit-input--time"
                            value={editFormData.deadlineTime}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, deadlineTime: e.target.value })
                            }
                            placeholder="Optional Time"
                          />
                        </div>
                      ) : (
                        <span className="detail-value highlight-date">
                          {item.deadlineDate
                            ? new Date(`${item.deadlineDate}T00:00:00`).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })
                            : 'Date missing'}
                          {item.hasExplicitTime && item.deadlineTime && (
                            <span className="explicit-time-tag"> at {item.deadlineTime}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AMBIGUITY RESOLUTION BANNERS (Section 4 Compliance) */}
                  {!isEditing && item.status !== 'verified' && (
                    <div className="ambiguity-banner">
                      {/* A. Missing Year */}
                      {item.ambiguityType === 'missing_year' && (
                        <div className="ambiguity-content">
                          <div className="ambiguity-message">
                            <strong>⚠ Needs verification:</strong> Year missing from source. Extracted: {item.detectedPhrase}
                          </div>
                          <div className="ambiguity-actions">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                handleConfirmItem(item.id, {
                                  deadlineDate: item.suggestedDate,
                                })
                              }
                            >
                              Confirm {item.suggestedYear || '2026'} ({item.suggestedDate})
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* B. Relative Date */}
                      {item.ambiguityType === 'relative_date' && (
                        <div className="ambiguity-content">
                          <div className="ambiguity-message">
                            <strong>⚠ Needs verification:</strong> Detected relative phrase "{item.detectedPhrase}".
                            Suggested interpretation: <em>{item.suggestedDate}</em>
                          </div>
                          <div className="ambiguity-actions">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                handleConfirmItem(item.id, {
                                  deadlineDate: item.suggestedDate,
                                })
                              }
                            >
                              Confirm Suggestion ({item.suggestedDate})
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* C. Ambiguous Numeric Date */}
                      {item.ambiguityType === 'ambiguous_numeric_date' && (
                        <div className="ambiguity-content">
                          <div className="ambiguity-message">
                            <strong>⚠ Ambiguous numeric date:</strong> "{item.detectedPhrase}". Please specify format:
                          </div>
                          <div className="ambiguity-actions">
                            {item.ambiguousOptions?.map((opt, oIdx) => (
                              <Button
                                key={oIdx}
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleConfirmItem(item.id, {
                                    deadlineDate: opt.date,
                                  })
                                }
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* D. Conflicting Dates */}
                      {item.ambiguityType === 'conflicting_dates' && (
                        <div className="ambiguity-content ambiguity-content--danger">
                          <div className="ambiguity-message">
                            <strong>⚠ Conflicting deadlines:</strong> Multiple dates found in text. Select correct deadline:
                          </div>
                          <div className="ambiguity-actions">
                            {item.conflictingDates?.map((dStr, dIdx) => (
                              <Button
                                key={dIdx}
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  handleConfirmItem(item.id, {
                                    deadlineDate: formatDateISO(new Date(dStr + ' 2026')),
                                  })
                                }
                              >
                                Select {dStr}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generic Unparseable */}
                      {item.ambiguityType === 'unparseable' && (
                        <div className="ambiguity-content">
                          <div className="ambiguity-message">
                            <strong>⚠ {item.message || 'Could not confidently extract a deadline.'}</strong> Please edit manually.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Supporting Source Text (Section 12 Mandatory) */}
                  <div className="supporting-source-box">
                    <span className="source-label">Source Evidence:</span>
                    <blockquote className="source-text">
                      "{item.supportingSource || item.originalText}"
                    </blockquote>
                  </div>

                  {/* Footer Controls */}
                  <div className="deadline-card-footer">
                    {isEditing ? (
                      <div className="edit-actions">
                        <Button variant="primary" size="sm" onClick={() => saveEdit(item.id)}>
                          💾 Save & Verify
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="card-actions">
                        {item.status !== 'verified' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleConfirmItem(item.id)}
                          >
                            ✓ Confirm Deadline
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
                          ✏️ Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 5, 6, 7 & 8: Chronological Verified List & Exact 48h Cluster UI */}
      {extractedItems.length > 0 && (
        <section className="pileup-step-section">
          <div className="step-header">
            <span className="step-number">STEP 5, 6 & 7</span>
            <h2>Chronological Verification & Cluster Analysis</h2>
          </div>

          {/* EXACT 48-HOUR CLUSTER DISPLAY (Section 7, 9 & 10 Compliance) */}
          <div className="cluster-analysis-panel">
            {clusterResults.hasClusters ? (
              <div className="cluster-alert-box animate-pulse-border">
                <div className="cluster-alert-header">
                  <span className="alert-icon">⚠</span>
                  <div>
                    <h3 className="cluster-alert-title">CROWDED PERIOD DETECTED</h3>
                    <p className="cluster-alert-subtitle">
                      Deterministic application code identified deadline conflict(s) matching the 48-hour rule.
                    </p>
                  </div>
                </div>

                {clusterResults.clusters.map((cluster, cIdx) => (
                  <div key={cluster.id} className="cluster-card">
                    <div className="cluster-card-badge">
                      <span>{cluster.count} submissions within {cluster.spanHours} hours (≤ 48h rule)</span>
                    </div>

                    <div className="cluster-items-grouped">
                      {cluster.items.map((cItem) => (
                        <div key={cItem.id} className="cluster-grouped-row">
                          <div className="cluster-date-col">
                            {cItem.normalizedDate.toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {cItem.hasExplicitTime && cItem.deadlineTime && (
                              <span className="cluster-time-sub"> ({cItem.deadlineTime})</span>
                            )}
                          </div>
                          <div className="cluster-info-col">
                            <strong>• {cItem.title}</strong>
                            <span className="cluster-subject-name">• {cItem.subject}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-cluster-box">
                <span className="no-cluster-icon">✓</span>
                <div className="no-cluster-text">
                  <h3>No crowded deadline period detected.</h3>
                  <p>
                    All verified deadlines have adequate breathing room (no 3 or more submissions fall within a 48-hour window).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sorted Verified Timeline List */}
          <div className="verified-timeline-card">
            <h3>📅 Chronologically Sorted Verified Deadlines</h3>
            {clusterResults.sortedVerifiedItems.length === 0 ? (
              <p className="timeline-empty-text">
                No verified deadlines yet. Confirm or edit item cards above to include them in the chronological analysis.
              </p>
            ) : (
              <div className="timeline-list">
                {clusterResults.sortedVerifiedItems.map((item, index) => {
                  const isClustered = clusterResults.clusteredItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`timeline-item ${isClustered ? 'timeline-item--clustered' : ''}`}
                    >
                      <div className="timeline-index">{index + 1}</div>
                      <div className="timeline-date">
                        {item.normalizedDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {item.hasExplicitTime && item.deadlineTime && (
                          <span className="timeline-time"> @ {item.deadlineTime}</span>
                        )}
                      </div>
                      <div className="timeline-content">
                        <strong>{item.title}</strong> ({item.subject})
                      </div>
                      {isClustered && (
                        <Badge variant="danger" size="sm">
                          ⚠ Crowded
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
