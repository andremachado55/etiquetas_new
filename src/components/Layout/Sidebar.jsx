import React from 'react';
import { Type, QrCode, Box, Trash2, Save, Upload, FileUp, Settings } from 'lucide-react';

export const Sidebar = ({
  onAddText,
  onAddBarcode,
  onAddBox,
  onSaveProject,
  onLoadProject,
  onShowImport,
  onClearCanvas,
  onToggleSettings
}) => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Label Architect Pro</h2>
        <p className="text-xs text-gray-500 mt-1">Editor de Etiquetas</p>
      </div>

      <div className="p-4 space-y-2 flex-1 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Ferramentas</h3>
          
          <button
            onClick={onAddText}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
          >
            <Type size={18} />
            Adicionar Texto
          </button>
        </div>

        <button
          onClick={onAddBarcode}
          className="w-full flex items-center gap-3 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition font-medium"
        >
          <QrCode size={18} />
          Código de Barras
        </button>

        <button
          onClick={onAddBox}
          className="w-full flex items-center gap-3 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition font-medium"
        >
          <Box size={18} />
          Adicionar Caixa
        </button>

        <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Projeto</h3>
          
          <button
            onClick={onSaveProject}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition font-medium"
          >
            <Save size={18} />
            Salvar Projeto
          </button>

          <button
            onClick={onLoadProject}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition font-medium"
          >
            <Upload size={18} />
            Carregar Projeto
          </button>

          <button
            onClick={onShowImport}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition font-medium"
          >
            <FileUp size={18} />
            Importar Etiqueta
          </button>

          <button
            onClick={onToggleSettings}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition font-medium"
          >
            <Settings size={18} />
            Configurações
          </button>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-200">
          <button
            onClick={onClearCanvas}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-medium"
          >
            <Trash2 size={18} />
            Limpar Tudo
          </button>
        </div>
      </div>
    </aside>
  );
};
