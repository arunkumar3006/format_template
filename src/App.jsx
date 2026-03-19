import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
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
    setStatus([{ id: 1, msg: 'Initializing report generation...', active: true }]);

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

      addStatus('Processing 4,000+ data rows...');
      addStatus('Structuring report document...');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      addStatus('Generation Successful: Ready to download.');
      
    } catch (err) {
      setError(err.message);
      setStatus([]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="layout">
      <main className="content">
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
            <h3>1. Intelligent Dataset</h3>
            <p>{dataset ? dataset.name : "Select source file (XLSX / CSV)"}</p>
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
            <p>{template ? template.name : "Select Word template structure"}</p>
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
            <span>{isGenerating ? "Generating Report..." : "Generate Report"}</span>
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    href={downloadUrl}
                    download={`News_Report_${new Date().toISOString().split('T')[0]}.docx`}
                    className="btn-download-modern"
                  >
                    <Download size={20} /> Download Final Report
                  </motion.a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer style={{ marginTop: '5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          &copy; 2026 Reporting System &middot; Power by NEXUS LXML Core
        </footer>
      </main>
    </div>
  );
};

export default App;
