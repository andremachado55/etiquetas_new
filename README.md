# Label Architect Pro

Editor visual de etiquetas (Fabric.js + React) com importação e compilação para
**ZPL**, **PPLA**, **PPLB** e **EPL/DPL**.

Resultado da fusão de dois projetos:
- **etiquetas_new** — editor visual (canvas, propriedades, compiladores) — base deste repo.
- **Etq-Viewer** — engine de parsing real de DPL/PPLB/ZPL, incorporada como importação.

## Stack
- React 19 + Vite
- Fabric.js (canvas)
- bwip-js (geração real de código de barras: Code128, EAN-13, Code39, QR)
- Tailwind CSS

## Funcionalidades
- Adicionar texto, código de barras e caixas no canvas
- Editar propriedades de cada elemento
- Compilar o canvas pra ZPL / PPLA / PPLB / EPL
- **Importar etiqueta pronta**: cole código DPL, PPLA, PPLB ou ZPL e ele monta os
  elementos no canvas automaticamente, prontos pra editar (auto-detecção de linguagem)
- Salvar/carregar projeto em JSON

## Rodando localmente
```bash
npm install
npm run dev
```

## Estrutura
```
src/
  components/    # UI (Sidebar, Canvas, Properties, Modals, CodePanel)
  compilers/      # Geração de código (ZPL/PPLA/PPLB/EPL) a partir do canvas
  hooks/          # useCanvas (Fabric.js)
  utils/
    labelParsers.js   # Parsers DPL / PPLB / ZPL (importação) — vindo do Etq-Viewer
    pplaParser.js     # Parser PPLA legado (formato "Comando 2")
    barcodeGenerator.js
```
