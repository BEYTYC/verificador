import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FilePlus, 
  Loader2,
  ChevronRight,
  Download,
  Plus,
  Archive,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { analyzeGraduationDocuments, AnalysisResponse } from './services/gemini';
import { generateOrderedPdfWithTOC } from './services/pdfUtils';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const processFiles = async (fileList: File[]) => {
    const newFiles: FileWithStatus[] = [];
    for (const file of fileList) {
      if (file.type !== 'application/pdf') continue;
      const id = Math.random().toString(36).substring(7);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split('_');
      const studentName = parts[0].trim().toUpperCase().replace(/-/g, ' ');
      let extractedResponsible = 'SIN ASIGNAR';
      if (parts.length > 1) extractedResponsible = parts.slice(1).join(' ').trim().toUpperCase();

      newFiles.push({
        id, file, base64: null, loading: false, result: null, error: null,
        responsible: extractedResponsible, studentName
      });
    }
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      if (!selectedId) setSelectedId(newFiles[0].id);
    }
  };

  const analyzeFile = async (id: string) => {
    const fileData = files.find(f => f.id === id);
    if (!fileData || fileData.result) return;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, loading: true, error: null } : f));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(fileData.file);
      });
      const analysis = await analyzeGraduationDocuments(base64);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, loading: false, result: analysis, base64 } : f));
      audioRef.current?.play().catch(() => {});
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, loading: false, error: "Error de IA" } : f));
    }
  };

  const analyzeAll = async () => {
    setIsBatchProcessing(true);
    for (const file of files.filter(f => !f.result)) {
      await analyzeFile(file.id);
      await new Promise(res => setTimeout(res, 1000));
    }
    setIsBatchProcessing(false);
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
    <div className="min-h-screen bg-[#001f3f] text-white flex flex-col">
      <header className="bg-[#003366] border-b border-cyan-500/30 h-20 flex items-center px-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_ESCUELA_NAVAL} alt="Logo" className="h-12" />
            <h1 className="text-xl font-black uppercase italic tracking-tight">Verificador de Requisitos</h1>
          </div>
          <nav className="flex gap-6">
            <button onClick={() => setActiveView('individual')} className={`text-xs font-bold uppercase ${activeView === 'individual' ? 'text-cyan-400 border-b' : ''}`}>Individuales</button>
            <button onClick={() => setActiveView('summary')} className={`text-xs font-bold uppercase ${activeView === 'summary' ? 'text-cyan-400 border-b' : ''}`}>Resumen</button>
          </nav>
          <button className="bg-cyan-500 text-[#003366] px-6 py-2 rounded-full font-bold text-xs">Portal</button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-12 gap-6">
        {activeView === 'individual' ? (
          <>
            <aside className="col-span-3 bg-slate-800/50 rounded-2xl p-4 flex flex-col gap-4 border border-slate-700">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span className="text-[10px] font-bold text-slate-400">ARCHIVOS ({files.length})</span>
                <button onClick={() => fileInputRef.current?.click()} className="text-cyan-400"><Plus size={16}/></button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".pdf" />
              <div className="flex-1 overflow-y-auto space-y-1">
                {files.map(f => (
                  <div key={f.id} onClick={() => setSelectedId(f.id)} className={`p-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase border ${selectedId === f.id ? 'bg-cyan-500/20 border-cyan-500' : 'border-transparent'}`}>
                    {f.studentName}
                  </div>
                ))}
              </div>
              <button onClick={analyzeAll} disabled={isBatchProcessing} className="bg-cyan-500 text-[#003366] py-3 rounded-xl font-bold text-xs uppercase">Analizar Todo</button>
            </aside>

            <section className="col-span-9">
              {!selectedFile ? (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-3xl text-slate-500">
                  <Upload size={40} />
                  <p className="mt-2 font-bold">Cargue documentos para empezar</p>
                </div>
              ) : selectedFile.loading ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-cyan-500" size={40} />
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 text-slate-800 shadow-2xl">
                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-cyan-600 uppercase">Programa</p>
                    <h2 className="text-2xl font-black text-[#003366] uppercase">{selectedFile.result?.academicProgram || 'PENDIENTE'}</h2>
                    <p className="text-sm font-bold text-slate-500">Estudiante: {selectedFile.result?.personName || selectedFile.studentName}</p>
                  </div>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                        <tr>
                          <th className="px-6 py-3">Requisito</th>
                          <th className="px-6 py-3">Estado</th>
                          <th className="px-6 py-3">Páginas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs uppercase font-bold text-slate-700">
                        {selectedFile.result?.checklist.map((item, i) => (
                          <tr key={i}>
                            <td className="px-6 py-4">{item.item}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] ${item.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {item.status === 'present' ? 'COMPLETO' : 'FALTANTE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{item.pageRange}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="col-span-12 bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center text-[#003366]">
              <h3 className="font-black uppercase tracking-tighter">Resumen General</h3>
              <button onClick={downloadAllZip} className="bg-cyan-500 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <Archive size={16}/> Descargar ZIP
              </button>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                <tr><th className="px-8 py-4">Programa</th><th className="px-8 py-4">Estudiante</th><th className="px-8 py-4">Novedades</th></tr>
              </thead>
              <tbody className="divide-y text-slate-700 uppercase font-bold text-[11px]">
                {files.map(f => (
                  <tr key={f.id}>
                    <td className="px-8 py-4 text-slate-400">{f.result?.academicProgram || 'PENDIENTE'}</td>
                    <td className="px-8 py-4 text-[#003366]">{f.result?.personName || f.studentName}</td>
                    <td className="px-8 py-4">
                      <span className={`px-4 py-1 rounded-full text-[10px] ${f.result ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {f.result ? 'PROCESADO' : 'PENDIENTE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <footer className="p-6 text-center text-[10px] text-slate-500 uppercase tracking-widest">
        Copyright 2026 Oficina de Estadística - Escuela Naval de Cadetes "Almirante Padilla"
      </footer>
    </div>
  );
}
