import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../src/services/api';
import { authorizationHeader } from '../lib/session';
import {
  Upload, FileSpreadsheet, Table2, Download, ArrowRight, Check, AlertCircle,
  Loader2, CloudUpload, Sparkles, Trash2, Eye, FileText, Sheet, Globe, Webhook,
  Clock, BarChart3, Target, Zap, TrendingUp
} from 'lucide-react';

interface AnalysisResult {
  row: number;
  name?: string;
  email?: string;
  company?: string;
  raw_data?: Record<string, any>;
  intent?: string;
  urgency?: string;
  fit_score?: string;
  summary?: string;
  suggested_action?: string;
  category?: string;
  status?: string;
}

interface Analysis {
  id: string;
  fileName: string;
  createdAt: string;
  rowsProcessed: number;
  status: string;
}

export default function DataConnectors() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzingRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filePreview, setFilePreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [resultsMeta, setResultsMeta] = useState<{ batchId: string; fileName: string; totalRows: number; processedRows: number; wasLimited: boolean; maxRows: number } | null>(null);
  
  const [history, setHistory] = useState<Analysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Google Sheets state
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false);
  const [sheetConnected, setSheetConnected] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');

  // Slack notification state
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [isSavingSlack, setIsSavingSlack] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchDataSources();
    fetchNotificationSettings();
    if (user) {
      void api.get<{ serviceAccountEmail: string }>('/api/connectors/google-sheets/service-account')
        .then(result => setServiceAccountEmail(result.serviceAccountEmail))
        .catch(() => setServiceAccountEmail(''));
    }
  }, [user]);

  const fetchNotificationSettings = async () => {
    if (!user) return;
    try {
      const response = await api.get<{ slackWebhookUrl?: string }>('/api/integrations/notifications');
      if (response && response.slackWebhookUrl) {
        setSlackWebhookUrl(response.slackWebhookUrl);
        setSlackConnected(true);
      }
    } catch (err) {
      console.error('Failed to fetch notification settings', err);
    }
  };

  const fetchDataSources = async () => {
    if (!user) return;
    try {
      const response = await api.get('/api/connectors');
      if (Array.isArray(response)) {
        const sheets = response.find(s => s.id === 'google-sheets');
        if (sheets && sheets.connected && sheets.config?.spreadsheetId) {
          setSheetConnected(true);
          setSpreadsheetId(sheets.config.spreadsheetId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data sources', err);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const response = await api.get<{ analyses: Analysis[] }>('/api/analyze/history');
      if (response && response.analyses) {
        setHistory(response.analyses);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const parseFilePreview = async (selectedFile: File) => {
    return new Promise<{ headers: string[]; rows: string[][] }>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1, 4).map(line => 
          line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        );
        resolve({ headers, rows });
      };
      reader.readAsText(selectedFile);
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Please upload a CSV or Excel file.');
      return;
    }
    
    setError(null);
    setFile(selectedFile);
    
    try {
      const preview = await parseFilePreview(selectedFile);
      setFilePreview(preview);
    } catch (err) {
      setError('Failed to read file preview.');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!file || analyzingRef.current) return;
    analyzingRef.current = true;
    
    setIsAnalyzing(true);
    setError(null);
    setResults(null);
    setResultsMeta(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = await authorizationHeader();

      const res = await fetch('/api/analyze/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Upload failed (status ${res.status}). Please try again.`);
      }
      const data = await res.json();
      if (!data || data.success === false || !Array.isArray(data.results)) {
        throw new Error(data?.error || 'Invalid upload response. Please try again.');
      }
      
      setResults(data.results);
      setResultsMeta({
        batchId: data.batchId,
        fileName: data.fileName,
        totalRows: data.totalRows,
        processedRows: data.processedRows,
        wasLimited: data.wasLimited,
        maxRows: data.maxRows
      });
      setFilePreview(null);
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const extractSpreadsheetId = (urlOrId: string): string => {
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return urlOrId.trim();
  };

  const verifyGoogleSheet = async () => {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (!cleanId) return;
    setIsVerifyingSheet(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; title?: string }>('/api/connectors/google-sheets/verify', { spreadsheetId: cleanId });
      if (response && response.success) {
        setSheetConnected(true);
        setSheetName(response.title || 'Google Sheet');
        setSpreadsheetId(cleanId);
        setShowSheetsModal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot access Google Sheet. Please ensure it is shared with nodalxai-b9eb5@appspot.gserviceaccount.com as Editor.');
    } finally {
      setIsVerifyingSheet(false);
    }
  };

  const saveSlackSettings = async () => {
    setIsSavingSlack(true);
    setError(null);
    try {
      await api.put('/api/integrations/notifications', { slackWebhookUrl, emailAlerts: true });
      setSlackConnected(!!slackWebhookUrl.trim());
      setShowSlackModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Slack settings');
    } finally {
      setIsSavingSlack(false);
    }
  };

  const runGoogleSheetsAnalysis = async () => {
    if (analyzingRef.current) return;
    if (!sheetConnected) {
      setShowSheetsModal(true);
      return;
    }
    analyzingRef.current = true;
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        totalRows: number;
        processedRows: number;
        results: AnalysisResult[];
      }>('/api/connectors/google-sheets/analyze', {});

      if (response && response.results) {
        setResults(response.results);
        setResultsMeta({
          batchId: 'sheet_' + Date.now(),
          fileName: sheetName || 'Connected Google Sheet',
          totalRows: response.totalRows,
          processedRows: response.processedRows,
          wasLimited: false,
          maxRows: 50
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze Google Sheet');
    } finally {
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const downloadResultsCSV = () => {
    if (!results || !resultsMeta) return;
    
    const headers = ['Row', 'Raw Data', 'Name', 'Email', 'Company', 'Intent', 'Urgency', 'Fit Score', 'Summary', 'Suggested Action', 'Category', 'Status'];
    const csvRows = [headers.join(',')];
    
    for (const r of results) {
      const row = [
        r.row, 
        `"${JSON.stringify(r.raw_data || {}).replace(/"/g, '""')}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.company || '').replace(/"/g, '""')}"`,
        r.intent || '',
        r.urgency || '',
        r.fit_score || '',
        `"${(r.summary || '').replace(/"/g, '""')}"`,
        `"${(r.suggested_action || '').replace(/"/g, '""')}"`,
        r.category || '',
        r.status || '',
      ];
      csvRows.push(row.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodalx-analysis-${resultsMeta.fileName.replace(/\.[^.]+$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFile(null);
    setFilePreview(null);
    setResults(null);
    setResultsMeta(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getIntentColor = (intent: string) => {
    const i = intent?.toLowerCase() || '';
    if (i.includes('purchase')) return 'bg-surface-hover text-text-primary';
    if (i.includes('partner')) return 'bg-surface-hover text-text-primary';
    if (i.includes('support')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    if (i.includes('spam')) return 'bg-red-500/10 text-red-600 dark:text-red-400';
    return 'bg-surface-hover text-text-primary';
  };

  const getUrgencyColor = (urgency: string) => {
    const u = urgency?.toLowerCase() || '';
    if (u === 'high') return 'bg-red-500/10 text-red-600 dark:text-red-400';
    if (u === 'medium') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    if (u === 'low') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    return 'bg-surface-hover text-text-primary';
  };

  const renderStats = () => {
    if (!results || !resultsMeta) return null;
    
    const highUrgency = results.filter(r => (r.urgency || '').toLowerCase() === 'high').length;
    
    const validScores = results.map(r => parseInt(r.fit_score || '0')).filter(s => !isNaN(s) && s > 0);
    const avgFitScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
    
    const intents = results.reduce((acc, r) => {
      const i = (r.intent || 'Unknown').toLowerCase();
      acc[i] = (acc[i] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let topIntent = 'None';
    let maxCount = 0;
    Object.entries(intents).forEach(([intent, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topIntent = intent;
      }
    });

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        <div className="g-card rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-surface-hover flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-text-primary" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary  font-medium tracking-wide">Total Analyzed</p>
            <p className="text-2xl font-extrabold text-text-primarytabular-nums">{resultsMeta.processedRows}</p>
          </div>
        </div>
        <div className="g-card rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-500/10  flex items-center justify-center">
            <Clock className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary  font-medium tracking-wide">High Urgency</p>
            <p className="text-2xl font-extrabold text-text-primarytabular-nums">{highUrgency}</p>
          </div>
        </div>
        <div className="g-card rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10  flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary  font-medium tracking-wide">Avg Fit Score</p>
            <p className="text-2xl font-extrabold text-text-primarytabular-nums">{avgFitScore || '—'}</p>
          </div>
        </div>
        <div className="g-card rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Target className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary  font-medium tracking-wide">Top Intent</p>
            <p className="text-2xl font-extrabold text-text-primarycapitalize truncate">{topIntent}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-bg border border-border">
          <Upload className="h-4 w-4 text-accent" />
          <span className="text-xs font-bold text-text-primary tracking-[0.15em] uppercase">Connectors</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Import existing inquiries</h1>
        <p className="text-text-tertiary  text-lg max-w-2xl leading-relaxed">
          Review old lead data from a file or Google Sheet. A connected sheet is a data source, not a live CRM sync.
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 p-5 rounded-xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-sm font-medium text-red-600 dark:text-red-400 pt-2.5">{error}</p>
        </div>
      )}

      {!results ? (
        <div className="g-panel rounded-2xl overflow-hidden p-7 md:p-8 space-y-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-border pb-7">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <Sheet className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight">
                  Analyze a Google Sheet
                </h2>
                <p className="text-text-tertiary  text-sm mt-1.5 leading-relaxed">
                  Classify up to 50 rows through your configured workflow, then write the returned AI fields back to the sheet. Analysis stops if the workflow fails.
                </p>
              </div>
            </div>

            <button
              onClick={runGoogleSheetsAnalysis}
              disabled={isAnalyzing}
              className="group px-6 py-3.5 bg-gradient-to-r from-accent to-accent-2 text-[#fff] font-bold rounded-xl shadow-lg shadow-accent/30 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing Sheet Rows...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Run AI Analysis
                </>
              )}
            </button>
          </div>

          {/* Connection Details Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface/50 border border-border ">
              <span className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Status</span>
              <span className="text-sm font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                {sheetConnected ? 'Sheet access verified' : 'No Sheet Connected'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-surface/50 border border-border ">
              <span className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Sheet Title</span>
              <span className="text-sm font-bold text-text-primary truncate block">
                {sheetName || (sheetConnected ? 'Connected Sheet' : 'Not Configured')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-surface/50 border border-border  flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Setup</span>
                <button onClick={() => setShowSheetsModal(true)} className="text-xs font-bold text-accent hover:underline">
                  {sheetConnected ? 'Change Sheet ID' : 'Connect Sheet ID'}
                </button>
              </div>
              <Sheet className="h-5 w-5 text-text-secondary" />
            </div>
          </div>

          {/* Service Account Access Box */}
          <div className="p-5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 space-y-2">
            <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Service Account Access Required
            </h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">
              {serviceAccountEmail ? <>Share your Google Sheet with Editor access to <code className="select-all break-all">{serviceAccountEmail}</code>.</> : 'The service account address is unavailable. Check the API connection before sharing your sheet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* Results Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Analysis Complete</h2>
              <p className="text-text-tertiary ">
                Processed {resultsMeta?.processedRows} rows from {resultsMeta?.fileName}
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={resetForm}
                className="px-4 py-2 g-chip text-text-primary rounded-lg hover:border-accent font-medium transition-colors"
              >
                Upload New File
              </button>
              <button 
                onClick={downloadResultsCSV}
                className="px-4 py-2 btn-primary text-[#fff] rounded-xl font-medium transition-all flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </div>

          {renderStats()}

          {/* Results Table */}
          <div className="g-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-hover text-text-tertiary border-b border-border ">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12 text-center">Row #</th>
                    <th className="px-4 py-3 font-medium min-w-[250px]">Lead Data</th>
                    <th className="px-4 py-3 font-medium min-w-[120px]">Intent</th>
                    <th className="px-4 py-3 font-medium min-w-[120px]">Urgency</th>
                    <th className="px-4 py-3 font-medium min-w-[150px]">Fit Score</th>
                    <th className="px-4 py-3 font-medium min-w-[250px]">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border ">
                  {results.map((r, idx) => (
                    <tr key={idx} className="bg-surface/50 hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-4 text-center text-text-tertiary ">{r.row}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5 max-w-[300px]">
                          {Object.entries(r.raw_data || {}).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="font-semibold text-text-primary mr-1">{key}:</span>
                              <span className="text-text-tertiary  break-words">{String(value)}</span>
                            </div>
                          ))}
                          {(!r.raw_data || Object.keys(r.raw_data).length === 0) && (
                            <span className="text-text-secondary italic text-xs">No data</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getIntentColor(r.intent || '')}`}>
                          {r.intent || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getUrgencyColor(r.urgency || '')}`}>
                          {r.urgency || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-text-primary">{r.fit_score ?? 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-text-tertiary  line-clamp-2" title={r.summary}>
                          {r.summary || '-'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Past Analyses */}
      {!results && history.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-text-primary">Past Analyses</h3>
          <div className="g-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-hover text-text-tertiary border-b border-border ">
                  <tr>
                    <th className="px-6 py-3 font-medium">File Name</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Rows</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border ">
                  {history.map((item) => (
                    <tr key={item.id} className="bg-surface/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-text-secondary" />
                          <span className="font-medium text-text-primary">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-tertiary ">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-text-tertiary ">
                        {item.rowsProcessed}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                          item.status === 'completed' ? 'bg-green-500/15 text-green-600 dark:text-green-400 ' :
                          'bg-amber-500/15 text-amber-600 dark:text-amber-400 '
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-text-tertiary">Saved analysis</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Grid */}
      <div className="pt-8">
        <h3 className="text-xl font-bold text-text-primary mb-5 tracking-tight">Optional connections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Google Sheets Card */}
          <button onClick={() => setShowSheetsModal(true)} className="group relative text-left bg-surface border border-border rounded-2xl p-6  overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="absolute top-0 right-0">
                {sheetConnected ? (
                  <span className="px-3 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="px-3 py-1.5 g-chip text-text-tertiary text-xs font-bold rounded-full group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                    Setup
                  </span>
                )}
              </div>
              <div className="h-14 w-14 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110">
                <Sheet className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-bold text-text-primary mb-2 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                Google Sheets access
              </h4>
              <p className="text-text-tertiary  text-sm leading-relaxed">
                Verify access, analyze existing rows, or export newly captured inquiries when configured.
              </p>
            </div>
            {sheetConnected && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent via-accent-2 to-accent" />}
          </button>

          {/* Slack Notifications Card */}
          <button onClick={() => setShowSlackModal(true)} className="group relative text-left bg-surface border border-border rounded-2xl p-6  overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="absolute top-0 right-0">
                {slackConnected ? (
                  <span className="px-3 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1.5 g-chip text-text-tertiary text-xs font-bold rounded-full group-hover:text-text-primary transition-colors duration-200">
                    Setup Alerts
                  </span>
                )}
              </div>
              <div className="h-14 w-14 rounded-xl g-chip text-text-secondary flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110">
                <Webhook className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-bold text-text-primary mb-2 tracking-tight group-hover:text-text-secondary transition-colors duration-200">
                Slack Alerts & Notifications
              </h4>
              <p className="text-text-tertiary  text-sm leading-relaxed">
                Send team notifications for newly captured inquiries. Test delivery before relying on alerts.
              </p>
            </div>
            {slackConnected && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-accent-2" />}
          </button>
        </div>
      </div>
      
      {/* Google Sheets Setup Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="w-full max-w-lg g-panel rounded-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Sheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary">Connect Google Sheet</h3>
                  <p className="text-sm text-text-tertiary ">Push classified inquiries to your spreadsheet</p>
                </div>
              </div>
              <button onClick={() => setShowSheetsModal(false)} className="text-text-secondary hover:text-text-primary">
                <Trash2 className="w-5 h-5 opacity-0" /> {/* Spacer */}
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                  <span className="bg-blue-500/20 text-blue-700 dark:text-blue-300 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                  Share your sheet with NodalX
                </h4>
                <p className="text-sm text-blue-700/80 dark:text-blue-400/80 mb-3">
                  Open your Google Sheet, click "Share", and add the service account as <strong>Editor</strong>:
                </p>
                <div className="space-y-2">
                  <div className="g-chip rounded-lg p-2.5 text-xs font-mono text-text-primary select-all break-all">
                    {serviceAccountEmail || 'Service account address unavailable. Check the API connection.'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="bg-accent/15 text-accent w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  Paste your Google Sheet URL or Spreadsheet ID
                </h4>
                <p className="text-xs text-text-tertiary ">
                  Paste the full link (e.g. <code>https://docs.google.com/spreadsheets/d/1BxiMv.../edit</code>) or just the ID.
                </p>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMvs0XRYFgCEb_w..."
                  className="w-full g-input rounded-lg px-4 py-3 text-text-primary text-sm"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
              <button 
                onClick={() => setShowSheetsModal(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button 
                onClick={verifyGoogleSheet}
                disabled={!spreadsheetId || isVerifyingSheet}
                className="px-6 py-2 btn-primary text-[#fff] text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isVerifyingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isVerifyingSheet ? 'Verifying...' : 'Connect Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slack Setup Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="w-full max-w-lg g-panel rounded-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg g-chip flex items-center justify-center">
                  <Webhook className="w-5 h-5 text-text-secondary" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary">Slack Notifications</h3>
                  <p className="text-sm text-text-tertiary ">Receive real-time sales alerts in Slack</p>
                </div>
              </div>
              <button onClick={() => setShowSlackModal(false)} className="text-text-secondary hover:text-text-primary">
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-surface border border-border rounded-xl p-4">
                <h4 className="text-sm font-bold text-text-primary mb-1">
                  How Slack Webhooks Work
                </h4>
                <p className="text-xs text-text-secondary">
                  Create an Incoming Webhook in your Slack workspace apps and paste the URL below. Whenever a new lead is captured, NodalX will instantly send a summary card to your team channel.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary">Slack Webhook URL</label>
                <input
                  type="url"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T0000/B0000/XXXXX"
                  className="w-full g-input rounded-lg px-4 py-3 text-text-primary text-sm"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-500/30">
                  {error}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
              <button 
                onClick={() => setShowSlackModal(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button 
                onClick={saveSlackSettings}
                disabled={isSavingSlack}
                className="px-6 py-2 btn-primary text-[#fff] text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isSavingSlack ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isSavingSlack ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
