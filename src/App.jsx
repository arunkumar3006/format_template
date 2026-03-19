import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  FileText, 
  Settings, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Newspaper,
  Crosshair,
  Briefcase,
  Activity,
  LogOut,
  Plus
} from 'lucide-react';
import './App.css';

const App = () => {
  const [dataset, setDataset] = useState(null);
  const [template, setTemplate] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState([]);

  const datasetRef = useRef(null);
  const templateRef = useRef(null);

  const addStatus = (msg) => {
    setStatus(prev => [...prev, { id: Date.now(), msg, complete: true }]);
  };

  const handleGenerate = async () => {
    if (!dataset || !template) return;

    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
    setStatus([{ id: 1, msg: 'Initializing nexus Mission...', active: true }]);

    try {
      const formData = new FormData();
      formData.append('dataset', dataset);
      formData.append('template', template);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to generate report');
      }

      addStatus('Decrypting 4,000+ data nodes...');
      addStatus('Assembling Strategic Briefing...');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      addStatus('Mission Accomplished: Report Ready.');
      
    } catch (err) {
      setError(err.message);
      setStatus([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-icon">✦</div>
          <div className="logo-text">
            <h2>Nexus</h2>
            <div className="logo-sub">Intelligence Tracker</div>
          </div>
        </div>

        <nav className="nav-menu">
          <a href="#" className="nav-item active"><LayoutDashboard /> Dashboard</a>
          <a href="#" className="nav-item"><Newspaper /> Articles</a>
          <a href="#" className="nav-item"><Crosshair /> Brand Tracker</a>
          <a href="#" className="nav-item"><Briefcase /> Jobs</a>
          <a href="#" className="nav-item"><Activity /> Diagnostics</a>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ padding: '0 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#10b981' }}>
             <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span> Connected
          </div>
          <a href="#" className="nav-item" style={{ color: '#ef4444' }}><LogOut /> Sign Out</a>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="content">
        <header className="header-meta animate-in">
          <h1>Intelligence Overview</h1>
          <p>Nexus Global — Strategic Command Center</p>
        </header>

        <div className="dashboard-grid">
          {/* Dataset Upload */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`stat-card animate-in ${dataset ? 'active' : ''}`}
            onClick={() => datasetRef.current.click()}
            style={{ animationDelay: '0.1s' }}
          >
            <div className="stat-icon"><FileSpreadsheet size={24} /></div>
            <h3>1. Intelligence Dataset</h3>
            <p>{dataset ? dataset.name : "Validated articles Excel / CSV "}</p>
            <input 
              type="file" 
              ref={datasetRef} 
              onChange={(e) => setDataset(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
            />
          </motion.div>

          {/* Template Upload */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`stat-card animate-in ${template ? 'active' : ''}`}
            onClick={() => templateRef.current.click()}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="stat-icon"><FileText size={24} /></div>
            <h3>2. Briefing Template</h3>
            <p>{template ? template.name : "Strategic report DOCX structure"}</p>
            <input 
              type="file" 
              ref={templateRef} 
              onChange={(e) => setTemplate(e.target.files[0])}
              accept=".docx"
            />
          </motion.div>
        </div>

        <section className="animate-in" style={{ animationDelay: '0.3s' }}>
          <button 
            className="btn-blue"
            onClick={handleGenerate}
            disabled={!dataset || !template || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus size={20} />
            )}
            <span>{isGenerating ? "Executing Mission..." : "New Intelligence Mission"}</span>
          </button>

          <AnimatePresence>
            {error && (
              <div className="status-box" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="status-line" style={{ color: '#ef4444' }}>
                  <AlertCircle size={18} /> {error}
                </div>
              </div>
            )}

            {(status.length > 0 || downloadUrl) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="status-box"
              >
                {status.map((s) => (
                  <div key={s.id} className="status-line" style={{ color: s.complete ? '#10b981' : '#2563eb' }}>
                     {s.complete ? <CheckCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
                     {s.msg}
                  </div>
                ))}
                
                {downloadUrl && (
                  <motion.a
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    href={downloadUrl}
                    download={`NEXUS_REPORT_${new Date().toISOString().split('T')[0]}.docx`}
                    className="btn-download-modern"
                  >
                    <Download size={20} /> Download Intelligence Summary
                  </motion.a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer style={{ marginTop: '5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          &copy; 2026 NEXUS GLOBAL &middot; STRATEGIC COMMAND HUB &middot; V.2.4.0
        </footer>
      </main>
    </div>
  );
};

export default App;
