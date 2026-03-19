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
  Zap
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
    setStatus([{ id: 1, msg: 'Initializing generation pipeline...', active: true }]);

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

      addStatus('Parsing 4,000+ data rows...');
      addStatus('Assembling high-performance document...');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      addStatus('Success: Report is ready!');
      
    } catch (err) {
      setError(err.message);
      setStatus([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      <header className="hero animate-in">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="icon-box glass"
          style={{ width: '80px', height: '80px', margin: '0 auto 2rem', background: 'var(--primary)', color: '#fff' }}
        >
          <Zap size={40} />
        </motion.div>
        
        <h1>News Report Generator</h1>
        <p>
          Transform massive media monitoring datasets into elegant corporate reports 
          using our adaptive, high-performance engine optimized for Vercel.
        </p>
      </header>

      <main className="config-grid">
        {/* Dataset Selection */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`upload-card glass ${dataset ? 'active' : ''}`}
          onClick={() => datasetRef.current.click()}
        >
          <div className="icon-box">
            <FileSpreadsheet size={32} />
          </div>
          <h3>1. Article Dataset</h3>
          <p>{dataset ? dataset.name : "Select Excel or CSV source"}</p>
          <input 
            type="file" 
            ref={datasetRef} 
            onChange={(e) => setDataset(e.target.files[0])}
            accept=".xlsx,.xls,.csv"
          />
        </motion.div>

        {/* Template Selection */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`upload-card glass ${template ? 'active' : ''}`}
          onClick={() => templateRef.current.click()}
        >
          <div className="icon-box">
            <FileText size={32} />
          </div>
          <h3>2. Word Template</h3>
          <p>{template ? template.name : "Select DOCX structure"}</p>
          <input 
            type="file" 
            ref={templateRef} 
            onChange={(e) => setTemplate(e.target.files[0])}
            accept=".docx"
          />
        </motion.div>
      </main>

      {/* Control Section */}
      <section className="animate-in" style={{ animationDelay: '0.2s' }}>
        <button 
          className="btn-generate"
          onClick={handleGenerate}
          disabled={!dataset || !template || isGenerating}
        >
          {isGenerating ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Loader2 className="animate-spin" /> Engine Running...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              🚀 Generate Professional Report <ArrowRight size={20} />
            </span>
          )}
        </button>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="progress-container glass"
              style={{ borderLeft: '4px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
            >
              <div className="status-step" style={{ color: '#f87171' }}>
                <AlertCircle size={18} /> {error}
              </div>
            </motion.div>
          )}

          {(status.length > 0 || downloadUrl) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="progress-container glass"
            >
              {status.map((s) => (
                <div key={s.id} className={`status-step ${s.complete ? 'complete' : 'active'}`}>
                   {s.complete ? <CheckCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
                   {s.msg}
                </div>
              ))}
              
              {downloadUrl && (
                <motion.a
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  href={downloadUrl}
                  download={`News_Report_${new Date().toISOString().split('T')[0]}.docx`}
                  className="btn-download"
                >
                  <Download size={20} /> Download Final Report (.docx)
                </motion.a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer style={{ marginTop: 'auto', paddingTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldCheck size={14} /> High-Performance LXML Word-Writer engine active
        </div>
        &copy; 2026 News Report Generator &middot; Enterprise Edition for Vercel Hybrid Apps
      </footer>
    </div>
  );
};

export default App;
