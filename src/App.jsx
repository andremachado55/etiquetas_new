import React, { useState, useRef } from 'react';
import { fabric } from 'fabric';
import { compile, preview } from './compilers/adapter';

// Components
import { Sidebar } from './components/Layout/Sidebar';
import { PropertiesPanel } from './components/Layout/PropertiesPanel';
import { SettingsBar } from './components/Canvas/SettingsBar';
import { LabelCanvas } from './components/Canvas/LabelCanvas';
import { ImportLabelModal } from './components/Modals/ImportLabelModal';
import { CodeOutput } from './components/CodePanel/CodeOutput';

// Hooks
import { useCanvas } from './hooks/useCanvas';

// Utils
import { generateBarcode } from './utils/barcodeGenerator';
import {
  parsePPLACode,
  calculateCanvasDimensions,
  mapPPLABarcodeType
} from './utils/pplaParser';
import { parseLabelCode, computeBoundsMM, mapBarcodeSymbol } from './utils/labelParsers';

function App() {
  const barcodeBufferRef = useRef(null);
  
  // Estados
  const [selectedObject, setSelectedObject] = useState(null);
  const [labelConfig, setLabelConfig] = useState({
    width: 100,
    height: 50,
    dpi: 8
  });
  const [compiledCode, setCompiledCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ZPL');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importLanguage, setImportLanguage] = useState('auto');

  // Canvas hook
  const { canvasRef, canvas } = useCanvas(labelConfig, setSelectedObject);

  // ============ FUNÇÕES DE ADIÇÃO DE ELEMENTOS ============
  
  const addText = () => {
    if (!canvas) return;
    
    const text = new fabric.IText('Novo Texto', {
      left: 50,
      top: 50,
      fontSize: 20,
      fontFamily: 'Arial'
    });
    text.appType = 'text';
    canvas.add(text);
    canvas.setActiveObject(text);
    compileCode();
  };

  const addBarcode = () => {
    if (!canvas) return;

    const barcodeData = '123456789';
    const imgData = generateBarcode(barcodeData, 'code128', true);

    if (imgData) {
      fabric.Image.fromURL(imgData, (img) => {
        img.set({
          left: 50,
          top: 50
        });
        img.appType = 'barcode';
        img.barcodeData = barcodeData;
        img.barcodeType = 'code128';
        img.showText = true;
        canvas.add(img);
        canvas.setActiveObject(img);
        compileCode();
      });
    }
  };

  const addBox = () => {
    if (!canvas) return;

    const box = new fabric.Rect({
      left: 50,
      top: 50,
      width: 100,
      height: 50,
      fill: 'transparent',
      stroke: 'black',
      strokeWidth: 2
    });
    box.appType = 'box';
    canvas.add(box);
    canvas.setActiveObject(box);
    compileCode();
  };

  // ============ GERENCIAMENTO DE CANVAS ============

  const clearCanvas = () => {
    if (!canvas) return;
    if (confirm('Deseja realmente limpar todo o canvas?')) {
      canvas.clear();
      canvas.backgroundColor = 'white';
      canvas.renderAll();
      setCompiledCode('');
      setSelectedObject(null);
    }
  };

  const deleteSelected = () => {
    if (!canvas || !selectedObject) return;
    canvas.remove(selectedObject);
    setSelectedObject(null);
    compileCode();
  };

  // ============ IMPORTAÇÃO/EXPORTAÇÃO ============

  const saveProject = () => {
    if (!canvas) return;

    const projectData = {
      version: '1.0',
      labelConfig,
      canvas: canvas.toJSON(['appType', 'barcodeData', 'barcodeType', 'showText'])
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'label-project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProject = () => {
    if (!canvas) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);
          
          if (projectData.labelConfig) {
            setLabelConfig(projectData.labelConfig);
          }

          setTimeout(() => {
            canvas.loadFromJSON(projectData.canvas, () => {
              canvas.renderAll();
              compileCode();
            });
          }, 100);
        } catch (error) {
          alert('Erro ao carregar o projeto: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  };

  // ============ IMPORTAÇÃO DE ETIQUETA (DPL / PPLA / PPLB / ZPL) ============

  const placeFabricElement = (canvas, el, lang) => {
    // mm -> unidade do canvas (dots), usando o mesmo dpi configurado na label
    const dpi = labelConfig.dpi;
    const left = el.xMM * dpi;
    // DPL é bottom-left (y sobe a partir da base); o resto é top-left.
    // O canvas Fabric é sempre top-left, então em DPL convertemos depois de saber a altura da label.
    const top = el.yMM * dpi;

    if (el.type === 'text') {
      const text = new fabric.IText(el.text, {
        left, top,
        fontSize: Math.max((el.fontSizeMM || 2.5) * dpi, 8),
        fontFamily: 'Arial',
        angle: el.rot || 0,
        scaleX: el.xScale || el.wMul || 1
      });
      text.appType = 'text';
      canvas.add(text);
      return;
    }

    if (el.type === 'barcode') {
      const barcodeType = mapBarcodeSymbol(lang, el.symbol);
      const imgData = generateBarcode(el.data || '', barcodeType, el.humanReadable !== false);
      if (imgData) {
        fabric.Image.fromURL(imgData, (img) => {
          img.set({ left, top, angle: el.rot || 0 });
          img.appType = 'barcode';
          img.barcodeData = el.data || '';
          img.barcodeType = barcodeType;
          img.showText = el.humanReadable !== false;
          canvas.add(img);
          canvas.renderAll();
        });
      }
      return;
    }

    if (el.type === 'box') {
      const box = new fabric.Rect({
        left, top,
        width: (el.wMM || 10) * dpi,
        height: (el.hMM || 10) * dpi,
        fill: 'transparent',
        stroke: 'black',
        strokeWidth: Math.max((el.thickMM || 0.3) * dpi, 1)
      });
      box.appType = 'box';
      canvas.add(box);
      return;
    }
    // 'graphic' (DPL ^X) e imagens não têm equivalente editável — ficam só no log.
  };

  const importLabelLegacyPPLA = () => {
    const elements = parsePPLACode(importCode);
    if (elements.length === 0) {
      alert('Nenhum comando PPLA (formato Comando 2) válido encontrado');
      return;
    }
    const dimensions = calculateCanvasDimensions(elements);
    setLabelConfig(prev => ({ ...prev, ...dimensions }));

    setTimeout(() => {
      canvas.clear();
      canvas.backgroundColor = 'white';

      elements.forEach(element => {
        switch (element.type) {
          case 'text': {
            const text = new fabric.IText(element.text, {
              left: element.x / 10,
              top: element.y / 10,
              fontSize: parseInt(element.hMultiplier) * 12,
              fontFamily: 'Arial',
              angle: element.orientation * 90
            });
            text.appType = 'text';
            canvas.add(text);
            break;
          }
          case 'barcode': {
            const barcodeType = mapPPLABarcodeType(element.barcodeType);
            const imgData = generateBarcode(element.data, barcodeType, true);
            if (imgData) {
              fabric.Image.fromURL(imgData, (img) => {
                img.set({ left: element.x / 10, top: element.y / 10, angle: element.orientation * 90 });
                img.appType = 'barcode';
                img.barcodeData = element.data;
                img.barcodeType = barcodeType;
                img.showText = true;
                canvas.add(img);
                canvas.renderAll();
              });
            }
            break;
          }
          case 'box': {
            const box = new fabric.Rect({
              left: element.x / 10,
              top: element.y / 10,
              width: element.width / 10,
              height: element.height / 10,
              fill: 'transparent',
              stroke: 'black',
              strokeWidth: Math.max(element.hThickness, element.vThickness) / 10
            });
            box.appType = 'box';
            canvas.add(box);
            break;
          }
          case 'line': {
            const line = new fabric.Line(
              [element.x / 10, element.y / 10, (element.x + element.width) / 10, (element.y + element.height) / 10],
              { stroke: 'black', strokeWidth: 2 }
            );
            line.appType = 'line';
            canvas.add(line);
            break;
          }
          default: break;
        }
      });

      canvas.renderAll();
      compileCode();
      alert(`✓ ${elements.length} elementos importados com sucesso! (PPLA — formato Comando 2)`);
    }, 200);
  };

  const importLabel = () => {
    if (!canvas || !importCode.trim()) {
      alert('Cole o código da etiqueta antes de importar');
      return;
    }

    if (importLanguage === 'ppla-legacy') {
      importLabelLegacyPPLA();
      return;
    }

    try {
      const { labels, log, detectedLang } = parseLabelCode(importCode, importLanguage);
      const errors = log.filter(l => l.status === 'warn').length;

      if (!labels.length || !labels[0].elements.length) {
        alert(`Nenhum elemento reconhecido (linguagem: ${detectedLang}). Verifique o código ou selecione a linguagem manualmente.`);
        return;
      }

      const label = labels[0]; // por enquanto importa a primeira etiqueta do lote
      const bounds = computeBoundsMM(label);
      const widthMM = label.widthMM || bounds.width;
      const heightMM = label.heightMM || bounds.height;

      setLabelConfig(prev => ({ ...prev, width: Math.ceil(widthMM), height: Math.ceil(heightMM) }));

      setTimeout(() => {
        canvas.clear();
        canvas.backgroundColor = 'white';

        const heightDots = heightMM * labelConfig.dpi;
        const isBottomLeft = label.coordSystem === 'bottom-left';

        label.elements.forEach(el => {
          // Em DPL (bottom-left) convertemos yMM (da base) pra top do canvas.
          const adjusted = isBottomLeft ? { ...el, yMM: heightMM - el.yMM } : el;
          placeFabricElement(canvas, adjusted, detectedLang);
        });

        canvas.renderAll();
        compileCode();
        alert(`✓ ${label.elements.length} elemento(s) importado(s) (${detectedLang.toUpperCase()})` + (errors ? ` — ${errors} linha(s) ignorada(s), veja o console` : ''));
        if (errors) console.table(log.filter(l => l.status === 'warn'));
      }, 200);
    } catch (error) {
      alert('Erro ao importar etiqueta: ' + error.message);
      console.error(error);
    }
  };

  // ============ COMPILAÇÃO DE CÓDIGO ============

  const compileCode = (language = selectedLanguage) => {
    if (!canvas) return;
    
    try {
      const code = compile(canvas, labelConfig, language);
      setCompiledCode(code);
    } catch (error) {
      console.error('Erro ao compilar:', error);
    }
  };

  const previewZPL = () => {
    if (!compiledCode) {
      alert('Nenhum código para visualizar');
      return;
    }
    preview(compiledCode, selectedLanguage);
  };

  // ============ RENDER ============

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Modal de Importação de Etiqueta */}
      <ImportLabelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        code={importCode}
        setCode={setImportCode}
        language={importLanguage}
        setLanguage={setImportLanguage}
        onImport={importLabel}
      />

      {/* Layout Principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Esquerda */}
        <Sidebar
          onAddText={addText}
          onAddBarcode={addBarcode}
          onAddBox={addBox}
          onSaveProject={saveProject}
          onLoadProject={loadProject}
          onShowImport={() => setShowImportModal(true)}
          onClearCanvas={clearCanvas}
          onToggleSettings={() => setShowSettings(!showSettings)}
        />

        {/* Área Central */}
        <main className="flex-1 flex flex-col">
          {/* Barra de Configurações */}
          <SettingsBar
            labelConfig={labelConfig}
            onConfigChange={setLabelConfig}
            isVisible={showSettings}
          />

          {/* Canvas */}
          <LabelCanvas canvasRef={canvasRef} />
        </main>

        {/* Painel Direito */}
        <div className="w-96 flex flex-col">
          {/* Propriedades */}
          <div className="flex-1 overflow-y-auto">
            <PropertiesPanel
              selectedObject={selectedObject}
              canvas={canvas}
              onDelete={deleteSelected}
              onCompile={compileCode}
            />
          </div>

          {/* Código Gerado */}
          <CodeOutput
            compiledCode={compiledCode}
            selectedLanguage={selectedLanguage}
            onLanguageChange={(lang) => {
              setSelectedLanguage(lang);
              setTimeout(() => compileCode(lang), 0);
            }}
            onPreview={previewZPL}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
