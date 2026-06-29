import React from 'react';
import { X, FileUp } from 'lucide-react';

const LANG_OPTIONS = [
  { value: 'auto', label: 'Auto-detectar' },
  { value: 'dpl', label: 'DPL/PPLA (Argox, Datamax)' },
  { value: 'ppla-legacy', label: 'PPLA (formato Comando 2)' },
  { value: 'pplb', label: 'PPLB (Argox)' },
  { value: 'zpl', label: 'ZPL (Zebra, Elgin)' }
];

export const ImportLabelModal = ({ isOpen, onClose, code, setCode, language, setLanguage, onImport }) => {
  if (!isOpen) return null;

  const handleImport = () => {
    onImport();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileUp className="text-blue-500" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Importar Etiqueta</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-3">
            Cole o código da etiqueta (DPL, PPLA, PPLB ou ZPL). O sistema detecta a linguagem
            automaticamente e cria os elementos no canvas, prontos pra editar.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Linguagem
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {LANG_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Cole o código da etiqueta aqui..."
            className="mt-3 w-full h-80 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
          >
            Importar
          </button>
        </div>
      </div>
    </div>
  );
};
