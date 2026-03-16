import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  FilePlus, 
  Loader2,
  ChevronRight,
  Info,
  Download,
  Files,
  Trash2,
  Plus,
  Archive,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Corregido import de motion
import JSZip from 'jszip';
import { analyzeGraduationDocuments, AnalysisResponse } from './services/gemini';
import { reorderPdf, generateOrderedPdfWithTOC } from './services/pdfUtils';

interface FileWithStatus {
  id: string;
  file: File;
  base64: string | null;
  loading: boolean;
  result: AnalysisResponse | null;
  error: string | null;
  responsible: string;
  studentName: string;
}

const LOGO_ESCUELA_NAVAL = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Escudo_Escuela_Naval_de_Cadetes_Almirante_Padilla.svg/1200px-Escudo_Escuela_Naval_de_Cadetes_Almirante_Padilla.svg.png"; 

export default function App() {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'individual' | 'summary'>('individual');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const playSuccessSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Error al reproducir sonido:", e));
    }
  };

  const processFiles = async (fileList: File[]) => {
    const newFiles: FileWithStatus[] = [];
    
    for (const file of fileList) {
      if (file.type !== 'application/pdf') {
        setGlobalError('Solo se permiten archivos PDF.');
        continue;
      }
      
      const id = Math.random().toString(36).substring(7);
      
      // Lógica de extracción de nombres desde el nombre del archivo
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split('_');
      const studentName = parts[0].trim().toUpperCase().replace(/-/g, ' ');
      
      let extractedResponsible = 'SIN ASIGNAR';
      if (parts.length > 1) {
        extractedResponsible = parts.slice(1).join(' ').trim().toUpperCase();
      }

      newFiles.push({
        id,
        file,
        base64: null,
        loading: false,
        result: null,
        error: null,
        responsible: extractedResponsible,
        studentName: studentName
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      if (!selectedId) setSelectedId(newFiles[0].id);
      setGlobalError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const analyzeFile = async (id: string, silent: boolean = false) => {
    const fileData = files.find(f => f.id === id);
    if (!fileData || fileData.result) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, loading: true, error: null } : f));

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(fileData.file);
      });

      const base64 = await base64Promise;
      const analysis = await analyzeGraduationDocuments(base64);
      
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        loading: false, 
        result: analysis,
        base64: base64 
      } : f));
      
      if (!silent) playSuccessSound();
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        loading: false, 
        error: "Error de conexión con Gemini" 
      } : f));
    }
  };

  const analyzeAll = async () => {
    setIsBatchProcessing(true);
    const pending = files.filter(f => !f.result);
    for (const file of pending) {
      await analyzeFile(file.id, true);
      await new Promise(res => setTimeout(res, 1000)); // Delay para evitar saturar API
    }
    setIsBatchProcessing(false);
    playSuccessSound();
  };

  const downloadAllZip = async () => {
    setIsDownloadingZip(true);
    const zip = new JSZip();
    for (const f of files) {
      if (f.result && f.base64) {
        const pdfBytes = await generateOrderedPdfWithTOC(f.base64, f.result.checklist, f.result.personName);
        zip.file(`${f.studentName}.pdf`, pdfBytes);
      } else {
        zip.file(f.file.name, f.file);
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "REQUISITOS_GRADO.zip";
    link.click();
    setIsDownloadingZip(false);
  };

  const selectedFile = files.find(f => f.id === selectedId);

  return (
    <div className="min-h-screen bg-[#001f3f] text-white font-sans flex flex-col">
      {/* HEADER ESTILO ESCUELA NAVAL */}
      <header className="bg-[#003366] border-b border-cyan-500/30 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_ESCUELA_NAVAL} alt="Logo" className="h-14 w-auto drop-shadow-lg" />
            <div>
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Secretaría Académica</p>
              <h1 className="text-xl font-black italic uppercase tracking-tight">Verificador de Requisitos</h1>
            </div>
          </div>
          <nav className="flex gap-8">
            <button onClick={() => setActiveView('individual')} className={`text-sm font-bold uppercase transition-all ${activeView === 'individual' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-300'}`}>
              Individuales
            </button>
            <button onClick={() => setActiveView('summary')} className={`text-sm font-bold uppercase transition-all ${activeView === 'summary' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-300'}`}>
              Resumen
            </button>
          </nav>
          <button className="bg-cyan-500 hover:bg-cyan-400 text-[#003366] px-6 py-2 rounded-full font-bold text-sm transition-all shadow-lg">
            Volver al portal
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-12 gap-6">
        {activeView === 'individual' ? (
          <>
            {/* LISTA LATERAL */}
            <aside className="col-span-3 bg-slate-800/50 rounded-2xl border border-slate-700 p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Archivos ({files.length})</span>
                <button onClick={() => fileInputRef.current?.click()} className="text-cyan-400 hover:text-white"><Plus /></button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".pdf" />
              
              <div className="flex-1 overflow-y-auto space-y-2">
                {files.map(f => (
                  <div key={f.id} onClick={() => setSelectedId(f.id)} className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedId === f.id ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-900/50 border-transparent hover:border-slate-600'}`}>
                    <div className="flex items-center gap-2">
                      {f.loading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : 
                       f.result ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <FileText className="w-4 h-4 text-slate-500" />}
                      <span className="text-xs font-bold truncate uppercase">{f.studentName}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={analyzeAll} disabled={isBatchProcessing || files.length === 0} className="w-full py-3 bg-cyan-500 text-[#003366] font-bold rounded-xl hover:bg-cyan-400 disabled:opacity-50">
                {isBatchProcessing ? 'PROCESANDO...' : 'ANALIZAR TODO'}
              </button>
            </aside>

            {/* AREA DE RESULTADOS */}
            <section className="col-span-9">
              <AnimatePresence mode="wait">
                {!selectedFile ? (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-3xl p-20 text-slate-500">
                    <Upload size={48} className="mb-4" />
                    <p className="text-lg font-bold">Cargue los documentos PDF para comenzar</p>
                  </div>
                ) : selectedFile.loading ? (
                  <div className="h-full flex flex-col items-center justify-center bg-slate-800/30 rounded-3xl">
                    <Loader2 size={48} className="animate-spin text-cyan-500 mb-4" />
                    <p className="text-xl font-bold">La IA está analizando el documento...</p>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 text-slate-800 shadow-xl">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-bold text-cyan-600 uppercase">Programa Académico</p>
                          <h2 className="text-2xl font-black text-[#003366] uppercase tracking-tighter">
                            {selectedFile.result?.academicProgram || 'PROGRAMA NO DETECTADO'}
                          </h2>
                          <p className="text-sm font-bold text-slate-500 mt-1">Estudiante: {selectedFile.result?.personName || selectedFile.studentName}</p>
                        </div>
                        <button onClick={() => analyzeFile(selectedFile.id)} className="bg-slate-100 p-2 rounded-lg hover:bg-slate-200 transition-all text-slate-600">
                          <AlertCircle />
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                            <tr>
                              <th className="px-6 py-3">Requisito</th>
                              <th className="px-6 py-3">Estado</th>
                              <th className="px-6 py-3">Páginas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedFile.result?.checklist.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{item.item}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-re
