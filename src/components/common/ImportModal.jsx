// src/components/common/ImportModal.jsx
//
// Komponen modal import Excel yang dapat digunakan bersama oleh berbagai halaman.
//
// Props:
//   isOpen            {boolean}   — tampilkan / sembunyikan modal
//   onClose           {function}  — callback saat modal ditutup
//   onFileSelect      {function}  — callback(file) saat user memilih file, sebelum diproses
//   title             {string}    — judul modal, mis. "Import Mutasi Gudang"
//   templateFileName  {string}    — nama file template tanpa ekstensi, mis. "mutasi_gudang"
//   templateDriveUrl  {string}    — URL Google Drive untuk mengunduh file template
//   columns           {string[]}  — daftar nama kolom yang harus ada di file Excel
//   maxRows           {number}    — batas baris yang diproses (default 10.000)

import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

export default function ImportModal({
  isOpen,
  onClose,
  onFileSelect,
  title = 'Import Data',
  templateFileName = 'template',
  templateDriveUrl = '#',
  columns = [],
  maxRows = 10000,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const ALLOWED_EXT = ['.xls', '.xlsx'];

  const validateFile = (file) => {
    if (!file) return 'Tidak ada file yang dipilih.';
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return `Format file tidak didukung. Harap unggah file Microsoft Excel (${ALLOWED_EXT.join(', ')}).`;
    }
    return '';
  };

  const handleFile = (file) => {
    const err = validateFile(file);
    if (err) {
      setFileError(err);
      setSelectedFile(null);
      return;
    }
    setFileError('');
    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    handleFile(e.target.files[0]);
    // reset input sehingga file yang sama bisa dipilih ulang
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleProceed = () => {
    if (!selectedFile) {
      setFileError('Silahkan pilih file terlebih dahulu.');
      return;
    }
    onFileSelect && onFileSelect(selectedFile);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileError('');
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Persiapan File ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-500" />
              Persiapan File
            </h3>
            <ol className="space-y-2 text-sm text-gray-600 list-none">
              {[
                <>
                  File <strong>{title.replace('Import ', '')}</strong> harus dalam bentuk file Microsoft
                  Excel&nbsp;
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">*.xls</span>
                  {' '}atau{' '}
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">*.xlsx</span>
                </>,
                <>
                  TRK IMS menganggap <strong>baris pertama</strong> data adalah judul kolom —&nbsp;
                  baris pertama <strong>tidak akan diimpor</strong>.
                </>,
                <>
                  Gunakan karakter titik&nbsp;
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.</span>
                  &nbsp;sebagai pemisah desimal dan format tanggal&nbsp;
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">dd/mm/yyyy</span>
                  &nbsp;(contoh:&nbsp;
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">15/04/2024</span>).
                </>,
                <>
                  Untuk kolom kode referensi (Kode Gudang, Kode Barang, Kode Vendor, dll.),
                  TRK IMS <strong>hanya akan mengerti kode-kode yang sudah terdaftar</strong> di sistem.
                </>,
                <>
                  Anda dapat menggunakan file template Excel berikut:&nbsp;
                  <a
                    href={templateDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-medium underline underline-offset-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh {templateFileName}.xlsx
                  </a>
                </>,
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Kolom yang Diperlukan ── */}
          {/* {columns.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Kolom yang Diperlukan
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    {col}
                  </div>
                ))}
              </div>
            </section>
          )} */}

          {/* ── Proses Impor ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-green-600" />
              Proses Impor File
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              TRK IMS hanya akan memproses{' '}
              <strong>{maxRows.toLocaleString('id-ID')}&nbsp;baris pertama</strong> dari file Excel
              yang diunggah.
            </p>

            {/* Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${dragOver
                  ? 'border-green-400 bg-green-50'
                  : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                className="sr-only"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB — klik untuk ganti file
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-gray-300" />
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-green-600">Klik untuk unggah</span>
                    {' '}atau seret file ke sini
                  </p>
                  <p className="text-xs text-gray-400">Mendukung format .xls dan .xlsx</p>
                </div>
              )}
            </div>

            {/* Error message */}
            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {fileError}
              </p>
            )}
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 shrink-0 bg-white rounded-b-xl">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={!selectedFile}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Proses Impor
          </button>
        </div>
      </div>
    </div>
  );
}
