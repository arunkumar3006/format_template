import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  Settings, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  Link,
  Users,
  Calendar,
  Type,
  AlignLeft,
  Zap,
  Sparkles,
  Layers,
  HelpCircle,
  Info,
  Eye,
  ArrowRight,
  Maximize2,
  X,
  Table as TableIcon,
  Edit2,
  Save
} from 'lucide-react';
import './App.css';

const FIELD_POOL = [
  { id: 'title', label: 'Title', icon: <Type size={20} /> },
  { id: 'link', label: 'Resolved URL', icon: <Link size={20} /> },
  { id: 'publisher_author', label: 'Publisher/Agency | Author', icon: <Users size={20} /> },
  { id: 'summary_of_article', label: 'Summary', icon: <AlignLeft size={20} /> },
  { id: 'date_time', label: 'Published At', icon: <Calendar size={20} /> }
];

const App = () => {
  const [dataset, setDataset] = useState(null);
  const [dataPreview, setDataPreview] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [fields, setFields] = useState([...FIELD_POOL]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState([]);
  const [excludedRows, setExcludedRows] = useState([]);

  const datasetRef = useRef(null);

  const addStatus = (msg) => {
    setStatus(prev => [...prev, { id: Date.now(), msg, complete: true }]);
  };

  const fetchPreview = async (file) => {
    setIsPreviewLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('dataset', file);
    try {
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok) {
        setDataPreview({
          ...json,
          preview: json.preview.map((row, index) => ({ ...row, __originalIndex: index }))
        });
        setExcludedRows([]);
      } else {
        setError(json.error || "Failed to parse dataset.");
      }
    } catch (e) { 
      setError("Network error during preview synthesis.");
      console.error("Preview fetch failed", e); 
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDataset(file);
      setDataPreview(null);
      fetchPreview(file);
    }
  };

  const moveField = (index, direction) => {
    const newFields = [...fields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const addField = (field) => {
    if (!fields.find(f => f.id === field.id)) {
      setFields([...fields, field]);
    }
    setShowAddMenu(false);
  };

  const resetFields = () => {
    setFields([...FIELD_POOL]);
    setShowAddMenu(false);
  };

  const toggleRow = (index) => {
    setExcludedRows(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };
  
  const toggleAllRows = () => {
    if (excludedRows.length > 0) {
      setExcludedRows([]); // Select all (clear exclusions)
    } else {
      setExcludedRows(dataPreview.preview.map((_, i) => i)); // Deselect all (exclude all)
    }
  };

  const startEdit = (index, rowData) => {
    setEditingRow(index);
    setEditFormData({ ...rowData });
  };

  const saveEdit = (index) => {
    setDataPreview(prev => {
      const newPreview = [...prev.preview];
      newPreview[index] = { ...newPreview[index], ...editFormData };
      return { ...prev, preview: newPreview };
    });
    setEditingRow(null);
  };

  const handleEditChange = (key, value) => {
    setEditFormData(prev => ({ ...prev, [key]: value }));
  };

  const unusedFields = FIELD_POOL.filter(p => !fields.find(f => f.id === p.id));

  const handleGenerate = async () => {
    if (!dataset || fields.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setStatus([{ id: 1, msg: 'Calibrating AI synthesis...', active: true }]);

    try {
      if (!dataPreview || !dataPreview.preview) throw new Error("Preview data not ready.");

      // Ensure any active edits are applied immediately for generation
      let finalPreview = dataPreview.preview;
      if (editingRow !== null) {
        finalPreview = [...dataPreview.preview];
        finalPreview[editingRow] = { ...finalPreview[editingRow], ...editFormData };
        // We also want to save it to state so the UI reflects it
        setDataPreview(prev => ({ ...prev, preview: finalPreview }));
        setEditingRow(null);
      }

      // Front-end Filtering: Only build a dataset out of the rows the user kept.
      const dataToKeep = finalPreview.filter((_, i) => !excludedRows.includes(i));
      
      if (dataToKeep.length === 0) {
        throw new Error("Cannot generate a report with 0 articles.");
      }

      const headers = Object.keys(dataToKeep[0]).filter(k => k !== '__originalIndex');
      
      const csvContent = [
        headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
        ...dataToKeep.map(row => 
          headers.map(h => {
             const strVal = String(row[h] !== null && row[h] !== undefined ? row[h] : "");
             return `"${strVal.replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');
      
      // We pass the filtered subset as a fresh CSV file!
      const newDataset = new File([csvContent], "filtered_dataset.csv", { type: "text/csv" });

      const formData = new FormData();
      formData.append('dataset', newDataset);
      formData.append('field_order', fields.map(f => f.id).join(','));
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Synthesis Failed (${response.status})`);
      }

      addStatus('Neural mapping complete...');
      addStatus('Finalizing document architecture...');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      addStatus('Report Ready for Deployment.');
      
    } catch (err) {
      setError(err.message);
      setStatus([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="layout-elite">
      <div className="neural-overlay"></div>
      
      <main className="studio-container">
        <header className="studio-header">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="studio-badge">
            <Sparkles size={14} /> Intelligence Port
          </motion.div>
          <h1>Report <span>Generator</span></h1>
          <p>Transform raw analytics into boardroom-ready intelligence.</p>
        </header>

        <div className="three-pillar-grid">
          {/* STEP 1: UPLOAD */}
          <section className="pillar">
            <div className="pillar-label">
              <span className="step-num">01</span>
              Intel Acquisition
            </div>
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className={`pillar-card upload-zone ${dataset ? 'complete' : ''}`}
              onClick={() => dataset ? setShowPreviewModal(true) : datasetRef.current.click()}
            >
              <div className="uploader-content">
                <div className="pillar-icon">
                  {dataset ? <TableIcon size={32} /> : <FileSpreadsheet size={32} />}
                </div>
                <h3>{dataset ? "Inspecting Stream" : "Import Data"}</h3>
                <p>{dataset ? dataset.name : "Click to select XLSX/CSV dataset"}</p>
                {dataset && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inspect-btn">
                     <Maximize2 size={12} /> View Dataset Preview
                  </motion.div>
                )}
              </div>
              
              {dataset && (
                <div className="file-actions-row">
                  <button className="change-file-btn" onClick={() => datasetRef.current.click()}>Change Source</button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={datasetRef} 
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
              />
            </motion.div>
            <div className="pillar-hint">
              <Info size={14} /> Click card to preview uploaded articles.
            </div>
          </section>

          {/* STEP 2: CONFIGURE */}
          <section className="pillar">
            <div className="pillar-label">
              <span className="step-num">02</span>
              Structural Logic
            </div>
            <div className="pillar-card logic-zone">
              <div className="logic-header">
                <div className="logic-title">
                  <Settings size={18} /> Architecture
                </div>
                <div className="logic-actions">
                  <button onClick={() => setShowGuide(!showGuide)} className="icon-btn-pill"><HelpCircle size={16} /></button>
                  <button onClick={resetFields} className="icon-btn-pill"><RotateCcw size={16} /></button>
                </div>
              </div>

              <AnimatePresence>
                {showGuide && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0 }} className="mini-guide">
                    <p>Reorder layers to change report flow.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="logic-list">
                <AnimatePresence>
                  {fields.map((field, idx) => (
                    <motion.div layout key={field.id} className="logic-item">
                      <div className="logic-item-info">
                        <span className="item-icon-box">{field.icon}</span>
                        <span className="item-text">{field.label}</span>
                      </div>
                      <div className="logic-item-btns">
                        <button onClick={(e) => { e.stopPropagation(); moveField(idx, -1); }} disabled={idx === 0}><ArrowUp size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveField(idx, 1); }} disabled={idx === fields.length - 1}><ArrowDown size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="red-btn"><Trash2 size={16} /></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="add-logic-wrap">
                  <button className="add-logic-btn" onClick={() => setShowAddMenu(!showAddMenu)}>
                    <Plus size={16} /> Add Section
                  </button>
                  {showAddMenu && unusedFields.length > 0 && (
                    <div className="add-dropdown-elite">
                      {unusedFields.map(f => (
                        <div key={f.id} className="add-item-elite" onClick={() => addField(f)}>
                           {f.icon} {f.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: PREVIEW */}
          <section className="pillar">
            <div className="pillar-label">
              <span className="step-num">03</span>
              Visual Synthesis
            </div>
            <div className="pillar-card preview-zone">
              <div className="preview-indicator">
                <Eye size={16} /> Live Proof
              </div>
              <div className="paper-mock">
                <div className="mock-rule" />
                <div className="mock-content">
                  {fields.map(f => (
                    <div key={f.id} className={`mock-f field-${f.id}`}>
                      {f.id === 'title' && "Intelligence Synthesis: Q2 Market Shift"}
                      {f.id === 'link' && <a href="https://platform.intel/report-q2" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>https://platform.intel/report-q2</a>}
                      {f.id === 'publisher_author' && "Strategic Lab & Partners"}
                      {f.id === 'summary_of_article' && "Automated analysis reveals critical deviations in forecast patterns. Mitigation strategies recommended for immediate deployment."}
                      {f.id === 'date_time' && "Monday, April 13, 2026"}
                    </div>
                  ))}
                </div>
                <div className="mock-seal" />
              </div>
            </div>
          </section>
        </div>

        <section className="studio-footer">
          <div className="generate-wrap">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-generate-elite"
              onClick={handleGenerate}
              disabled={!dataset || isGenerating || fields.length === 0}
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Zap size={22} fill="currentColor" />}
              <span>{isGenerating ? "Generating..." : "Generate Report"}</span>
              <ArrowRight size={20} className="arrow-move" />
            </motion.button>
            
            <AnimatePresence>
              {(status.length > 0 || downloadUrl || error) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="system-log">
                   {error && <div className="log-line error-log"><AlertCircle size={16} /> {error}</div>}
                   {status.map(s => (
                     <div key={s.id} className="log-line">
                       <CheckCircle size={16} color="#10b981" /> {s.msg}
                     </div>
                   ))}
                   {downloadUrl && (
                     <a href={downloadUrl} download="Morning_Tracker_Elite.docx" className="log-btn-download">
                       <Download size={18} /> Download Strategic Briefing (.docx)
                     </a>
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* DATA PREVIEW MODAL */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="modal-backdrop"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }} 
              className="modal-card-beast"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                 <div className="modal-title">
                    <TableIcon size={20} /> FULL DATASET TRACE
                    {dataPreview && <span>{dataPreview.total_rows - excludedRows.length} Entries Selected</span>}
                 </div>
                 <button className="close-btn" onClick={() => setShowPreviewModal(false)}><X size={20} /></button>
              </div>
              
              <div className="modal-body">
                {isPreviewLoading ? (
                  <div className="modal-loader-wrap">
                    <Loader2 size={48} className="animate-spin" color="var(--primary)" />
                    <p>Synthesizing Data Matrix...</p>
                  </div>
                ) : dataPreview ? (
                  <div className="modal-table-wrap">
                    <table className="beast-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={dataPreview.preview.length > 0 && excludedRows.length === 0} 
                              onChange={toggleAllRows} 
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          {Object.keys(dataPreview.preview[0]).filter(k => k !== '__originalIndex').map(h => (
                            <th key={h}>{h.replace(/_/g, ' ').toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataPreview.preview.map((row, i) => (
                          <tr key={i} style={{ opacity: excludedRows.includes(i) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input 
                                type="checkbox" 
                                checked={!excludedRows.includes(i)} 
                                onChange={() => toggleRow(i)} 
                                style={{ cursor: 'pointer', verticalAlign: 'middle', marginRight: '8px' }}
                              />
                              {editingRow === i ? (
                                <button 
                                  onClick={() => saveEdit(i)} 
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', verticalAlign: 'middle', padding: '2px' }}
                                  title="Save Changes"
                                >
                                  <Save size={16} color="#10b981" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => startEdit(i, row)} 
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', verticalAlign: 'middle', padding: '2px' }}
                                  title="Edit Row"
                                >
                                  <Edit2 size={16} color="#64748b" />
                                </button>
                              )}
                            </td>
                            {Object.entries(row).filter(([k]) => k !== '__originalIndex').map(([k, v], j) => {
                              const strVal = String(v !== null && v !== undefined ? v : '');
                              const isLink = strVal.startsWith('http://') || strVal.startsWith('https://');
                              
                              if (editingRow === i) {
                                return (
                                  <td key={j} style={{ padding: '4px' }}>
                                    <textarea 
                                      value={editFormData[k] !== undefined ? editFormData[k] : strVal}
                                      onChange={(e) => handleEditChange(k, e.target.value)}
                                      style={{ 
                                        width: '100%', 
                                        minWidth: '150px',
                                        minHeight: '60px', 
                                        padding: '6px', 
                                        border: '1px solid #cbd5e1', 
                                        borderRadius: '4px', 
                                        fontSize: '13px', 
                                        fontFamily: 'inherit',
                                        resize: 'vertical'
                                      }}
                                    />
                                  </td>
                                );
                              }
                              
                              return (
                                <td key={j}>
                                  {isLink ? (
                                    <a href={strVal} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                      {strVal}
                                    </a>
                                  ) : (
                                    strVal
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : error ? (
                  <div className="modal-error-wrap">
                    <AlertCircle size={48} color="#ef4444" />
                    <p>{error}</p>
                    <button className="modal-btn-primary" onClick={() => datasetRef.current.click()}>Try Different File</button>
                  </div>
                ) : (
                  <div className="modal-loader-wrap">
                    <Info size={48} color="#94a3b8" />
                    <p>No data loaded.</p>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                 <div className="status-pill">{dataPreview?.message || (error ? "Mapping Failed" : "Awaiting Byte-stream...")}</div>
                 <div style={{ display: 'flex', gap: '12px' }}>
                   <button className="modal-btn-primary" onClick={() => setShowPreviewModal(false)} style={{ background: '#f1f5f9', color: '#64748b' }}>Close</button>
                   <button 
                     className="modal-btn-primary" 
                     onClick={() => { setShowPreviewModal(false); handleGenerate(); }}
                     disabled={isGenerating || fields.length === 0}
                     style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                   >
                     <CheckCircle size={16} /> Done & Generate
                   </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
