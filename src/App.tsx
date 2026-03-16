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
    const content = await zip.gener
