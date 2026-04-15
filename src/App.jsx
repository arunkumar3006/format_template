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
  Save,
  Ungroup,
  Square,
  CheckSquare,
  LogOut
} from 'lucide-react';
import './App.css';

const FIELD_POOL = {
  title: { id: 'title', label: 'Title', icon: <Type size={20} /> },
  link: { id: 'link', label: 'Resolved URL', icon: <Link size={20} /> },
  publisher_author: { id: 'publisher_author', label: 'Publisher/Author', icon: <Users size={20} /> },
  summary_of_article: { id: 'summary_of_article', label: 'Summary', icon: <AlignLeft size={20} /> },
  date_time: { id: 'date_time', label: 'Published At', icon: <Calendar size={20} /> }
};

const INITIAL_FIELDS = [
  { id: 'row-0', items: [FIELD_POOL.title] },
  { id: 'row-1', items: [FIELD_POOL.link] },
  { id: 'row-2', items: [FIELD_POOL.publisher_author] },
  { id: 'row-3', items: [FIELD_POOL.summary_of_article] },
  { id: 'row-4', items: [FIELD_POOL.date_time] }
];

const App = () => {
  const [dataset, setDataset] = useState(null);
  const [dataPreview, setDataPreview] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [selectedFields, setSelectedFields] = useState([]); 
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

  const moveRow = (index, direction) => {
    const newFields = [...fields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const removeRow = (rowId) => {
    setFields(fields.filter(r => r.id !== rowId));
  };

  const addField = (item) => {
    const newRow = { id: `row-${Date.now()}`, items: [item] };
    setFields([...fields, newRow]);
    setShowAddMenu(false);
  };

  const toggleSelection = (fieldId) => {
    setSelectedFields(prev => prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]);
  };

  const combineSelected = () => {
    if (selectedFields.length < 2) return;
    const itemsToCombine = [];
    fields.forEach(row => {
      row.items.forEach(item => {
        if (selectedFields.includes(item.id)) itemsToCombine.push(item);
      });
    });
    let firstRowIndex = fields.findIndex(row => row.items.some(it => selectedFields.includes(it.id)));
    const newFields = [];
    fields.forEach((row, idx) => {
      const remainingItems = row.items.filter(item => !selectedFields.includes(item.id));
      if (idx === firstRowIndex) {
        newFields.push({ id: `row-${Date.now()}`, items: itemsToCombine });
        if (remainingItems.length > 0) newFields.push({ id: `rem-${Date.now()}`, items: remainingItems });
      } else if (remainingItems.length > 0) {
        newFields.push({ ...row, items: remainingItems });
      }
    });
    setFields(newFields);
    setSelectedFields([]);
  };

  const extractSelected = () => {
    if (selectedFields.length === 0) return;
    const newFields = [];
    fields.forEach(row => {
      const toExtract = row.items.filter(it => selectedFields.includes(it.id));
      const remaining = row.items.filter(it => !selectedFields.includes(it.id));
      if (toExtract.length > 0 && remaining.length > 0) {
        newFields.push({ ...row, items: remaining });
        toExtract.forEach(it => {
          newFields.push({ id: `row-${Date.now()}-${it.id}`, items: [it] });
        });
      } else {
        newFields.push(row);
      }
    });
    setFields(newFields);
    setSelectedFields([]);
  };

  const ungroupRow = (rowId) => {
    const rowIndex = fields.findIndex(r => r.id === rowId);
    if (rowIndex === -1 || fields[rowIndex].items.length < 2) return;
    const items = fields[rowIndex].items;
    const newRows = items.map((it, idx) => ({ id: `${rowId}-${idx}-${Date.now()}`, items: [it] }));
    const newFields = [...fields];
    newFields.splice(rowIndex, 1, ...newRows);
    setFields(newFields);
  };

  const resetFields = () => {
    setFields(INITIAL_FIELDS);
    setSelectedFields([]);
    setShowAddMenu(false);
  };

  const toggleRowSelect = (index) => {
    setExcludedRows(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };
  
  const toggleAllRows = () => {
    if (excludedRows.length > 0) setExcludedRows([]);
    else setExcludedRows(dataPreview.preview.map((_, i) => i));
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

  const allSelectedIds = fields.flatMap(r => r.items.map(it => it.id));
  const unusedFields = Object.values(FIELD_POOL).filter(p => !allSelectedIds.includes(p.id));

  // Determine if selected fields are part of any multi-item group
  const canExtract = selectedFields.some(fid => {
    const row = fields.find(r => r.items.some(it => it.id === fid));
    return row && row.items.length > 1;
  });

  const handleGenerate = async () => {
    if (!dataset || fields.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setStatus([{ id: 1, msg: 'Calibrating AI synthesis...', active: true }]);
    try {
      if (!dataPreview || !dataPreview.preview) throw new Error("Preview data not ready.");
      let finalPreview = dataPreview.preview;
      if (editingRow !== null) {
        finalPreview = [...dataPreview.preview];
        finalPreview[editingRow] = { ...finalPreview[editingRow], ...editFormData };
        setDataPreview(prev => ({ ...prev, preview: finalPreview }));
        setEditingRow(null);
      }
      const dataToKeep = finalPreview.filter((_, i) => !excludedRows.includes(i));
      if (dataToKeep.length === 0) throw new Error("Cannot generate a report with 0 articles.");
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
      const newDataset = new File([csvContent], "filtered_dataset.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append('dataset', newDataset);
      const orderStr = fields.map(r => r.items.map(it => it.id).join('|')).join(',');
      formData.append('field_order', orderStr);
      const response = await fetch('/api/generate', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Synthesis Failed (${response.status})`);
      addStatus('Neural mapping complete...');
      addStatus('Finalizing document architecture...');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      addStatus('Report Ready.');
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="studio-badge"><Sparkles size={14} /> Intelligence Port</motion.div>
          <h1>Report <span>Generator</span></h1>
          <p>Transform raw analytics into boardroom-ready intelligence.</p>
        </header>

        <div className="three-pillar-grid">
          <section className="pillar">
            <div className="pillar-label"><span className="step-num">01</span> Intel Acquisition</div>
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className={`pillar-card upload-zone ${dataset ? 'complete' : ''}`}
              onClick={() => dataset ? setShowPreviewModal(true) : datasetRef.current.click()}
            >
              <div className="uploader-content">
                <div className="pillar-icon">{dataset ? <TableIcon size={32} /> : <FileSpreadsheet size={32} />}</div>
                <h3>{dataset ? "Inspecting Stream" : "Import Data"}</h3>
                <p>{dataset ? dataset.name : "Click to select XLSX/CSV dataset"}</p>
                {dataset && <div className="inspect-btn"><Maximize2 size={12} /> View Dataset Preview</div>}
              </div>
              {dataset && <div className="file-actions-row"><button className="change-file-btn" onClick={() => datasetRef.current.click()}>Change Source</button></div>}
              <input type="file" ref={datasetRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} />
            </motion.div>
          </section>

          <section className="pillar">
            <div className="pillar-label"><span className="step-num">02</span> Structural Logic</div>
            <div className="pillar-card logic-zone">
              <div className="logic-header">
                <div className="logic-title"><Settings size={18} /> Architecture</div>
                <div className="logic-actions">
                  {selectedFields.length >= 2 && (
                    <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={combineSelected} className="combine-btn-elite">
                      <Layers size={14} /> Combine
                    </motion.button>
                  )}
                  {canExtract && (
                    <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={extractSelected} className="extract-btn-elite">
                      <LogOut size={14} /> Separate
                    </motion.button>
                  )}
                  {selectedFields.length > 0 && (
                    <button onClick={() => setSelectedFields([])} className="clear-link-btn">Clear</button>
                  )}
                  <button onClick={() => setShowGuide(!showGuide)} className="icon-btn-pill"><HelpCircle size={16} /></button>
                  <button onClick={resetFields} className="icon-btn-pill"><RotateCcw size={16} /></button>
                </div>
              </div>

              <div className="logic-list">
                <AnimatePresence>
                  {fields.map((row, idx) => (
                    <motion.div layout key={row.id} className="logic-row">
                      <div className="logic-row-items">
                        {row.items.map(item => (
                          <div 
                            key={item.id} 
                            className={`logic-item ${selectedFields.includes(item.id) ? 'selected' : ''}`}
                            onClick={() => toggleSelection(item.id)}
                          >
                            <span className="selection-box">{selectedFields.includes(item.id) ? <CheckSquare size={14} /> : <Square size={14} />}</span>
                            <span className="item-icon-box">{item.icon}</span>
                            <span className="item-text">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="logic-row-actions">
                        {row.items.length > 1 && <button onClick={() => ungroupRow(row.id)} title="Ungroup row"><Ungroup size={16} /></button>}
                        <button onClick={() => moveRow(idx, -1)} disabled={idx === 0}><ArrowUp size={16} /></button>
                        <button onClick={() => moveRow(idx, 1)} disabled={idx === fields.length - 1}><ArrowDown size={16} /></button>
                        <button onClick={() => removeRow(row.id)} className="red-btn"><Trash2 size={16} /></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="add-logic-wrap">
                  <button className="add-logic-btn" onClick={() => setShowAddMenu(!showAddMenu)}><Plus size={16} /> Add Section</button>
                  {showAddMenu && unusedFields.length > 0 && (
                    <div className="add-dropdown-elite">{unusedFields.map(f => <div key={f.id} className="add-item-elite" onClick={() => addField(f)}>{f.icon} {f.label}</div>)}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pillar">
            <div className="pillar-label"><span className="step-num">03</span> Visual Synthesis</div>
            <div className="pillar-card preview-zone">
              <div className="preview-indicator"><Eye size={16} /> Live Proof</div>
              <div className="paper-mock">
                <div className="mock-rule" />
                <div className="mock-content">
                  {fields.map(row => (
                    <div key={row.id} className="mock-row">
                      {row.items.map((f, i) => (
                        <React.Fragment key={f.id}>
                          {i > 0 && <span className="mock-sep">|</span>}
                          <div className={`mock-f field-${f.id}`}>
                            {f.id === 'title' && "Intelligence Synthesis: Q2 Market Shift"}
                            {f.id === 'link' && "https://platform.intel/report-q2"}
                            {f.id === 'publisher_author' && "Strategic Lab & Partners"}
                            {f.id === 'summary_of_article' && "Automated analysis reveals critical deviations in forecast patterns. Mitigation strategies recommended for immediate deployment."}
                            {f.id === 'date_time' && "Monday, April 13, 2026"}
                          </div>
                        </React.Fragment>
                      ))}
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
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-generate-elite"
              onClick={handleGenerate} disabled={!dataset || isGenerating || fields.length === 0}
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Zap size={22} fill="currentColor" />}
              <span>{isGenerating ? "Generating..." : "Generate Report"}</span><ArrowRight size={20} className="arrow-move" />
            </motion.button>
            <AnimatePresence>
              {(status.length > 0 || downloadUrl || error) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="system-log">
                   {error && <div className="log-line error-log"><AlertCircle size={16} /> {error}</div>}
                   {status.map(s => <div key={s.id} className="log-line"><CheckCircle size={16} color="#10b981" /> {s.msg}</div>)}
                   {downloadUrl && <a href={downloadUrl} download="Morning_Tracker.docx" className="log-btn-download"><Download size={18} /> Download Strategic Briefing</a>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showPreviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-backdrop" onClick={() => setShowPreviewModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="modal-card-beast" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                 <div className="modal-title"><TableIcon size={20} /> FULL DATASET TRACE {dataPreview && <span>{dataPreview.total_rows - excludedRows.length} Selected</span>}</div>
                 <button className="close-btn" onClick={() => setShowPreviewModal(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                {isPreviewLoading ? (<div className="modal-loader-wrap"><Loader2 size={48} className="animate-spin" color="var(--primary)" /><p>Synthesizing...</p></div>) : dataPreview ? (
                  <div className="modal-table-wrap">
                    <table className="beast-table">
                      <thead><tr><th><input type="checkbox" checked={excludedRows.length === 0} onChange={toggleAllRows} /></th>{Object.keys(dataPreview.preview[0]).filter(k => k !== '__originalIndex').map(h => (<th key={h}>{h.toUpperCase()}</th>))}</tr></thead>
                      <tbody>{dataPreview.preview.map((row, i) => (
                        <tr key={i} style={{ opacity: excludedRows.includes(i) ? 0.4 : 1 }}>
                          <td><input type="checkbox" checked={!excludedRows.includes(i)} onChange={() => toggleRowSelect(i)} />{editingRow === i ? (<button onClick={() => saveEdit(i)}><Save size={16} /></button>) : (<button onClick={() => startEdit(i, row)}><Edit2 size={16} /></button>)}</td>
                          {Object.entries(row).filter(([k]) => k !== '__originalIndex').map(([k, v], j) => (
                            <td key={j}>{editingRow === i ? <textarea value={editFormData[k] || ''} onChange={(e) => handleEditChange(k, e.target.value)} className="edit-area" /> : String(v || '')}</td>
                          ))}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p>No data.</p>}
              </div>
              <div className="modal-footer">
                <button className="modal-btn-secondary" onClick={() => setShowPreviewModal(false)}>Done</button>
                <div className="modal-actions-right">
                  <button 
                    className="modal-btn-primary" 
                    onClick={() => {
                      setShowPreviewModal(false);
                      handleGenerate();
                    }}
                    disabled={!dataset || isGenerating || fields.length === 0}
                  >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    {isGenerating ? "Generating..." : "Generate Report"}
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
