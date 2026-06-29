/**
 * Parsers de etiqueta pronta: DPL/PPLA (Argox/Datamax), PPLB (Argox) e ZPL (Zebra/Elgin).
 * Portado do ETQ. Viewer (HTML standalone) pra dentro do Label Architect Pro.
 *
 * Todos os parsers devolvem o mesmo formato:
 *   { labels: [ { elements: [...], widthMM, heightMM, coordSystem } ], log: [...] }
 *
 * coordSystem:
 *   'bottom-left' -> xMM da esquerda, yMM de BAIXO (DPL)
 *   'top-left'    -> xMM da esquerda, yMM do TOPO (PPLB, ZPL)
 *
 * Elemento:
 *   text:    { type:'text', xMM, yMM, rot, wMul, hMul, xScale, fontSizeMM, text, reverse }
 *   barcode: { type:'barcode', xMM, yMM, rot, symbol, narrowMM, wideMM, heightMM, humanReadable, data }
 *   box:     { type:'box', xMM, yMM, wMM, hMM, thickMM }
 *   graphic: { type:'graphic', xMM, yMM, spec }  -> não renderizável, só log
 */

const DOTS_PER_MM = 8;

// DPL: altura de fonte (mm) no multiplicador 1
const DPL_FONT_H = { '0': 2.0, '1': 2.3, '2': 2.6, '3': 3.0, '4': 3.5, '5': 4.2, '6': 5.0, '7': 6.0, '8': 7.5, '9': 3.5 };

// PPLB: altura de fonte (mm) no multiplicador 1
const PPLB_FONT_H = { 1: 1.0, 2: 2.0, 3: 2.5, 4: 3.0, 5: 6.0 };

function multVal(ch) {
  if (/[1-9]/.test(ch)) return parseInt(ch, 10);
  if (/[A-O]/i.test(ch)) return 10 + (ch.toUpperCase().charCodeAt(0) - 65);
  return 1;
}

function stripCtrl(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/^[\x00-\x1F\x7F\uFFFD\u2588□~]+/, '').replace(/[\x00-\x1F\x7F\uFFFD]+$/, '');
}

/** Auto-detecta a linguagem a partir do texto colado. */
export function detectLanguage(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 25)) {
    if (line.startsWith('^')) return 'zpl';
    if (line === 'N' || line === 'rN') return 'pplb';
    if (/^[Aa]\d+,\d+,\d+,\d+,\d+,\d+,[NRnr]/.test(line)) return 'pplb';
    if (/^[Bb]\d+,\d+,\d+,[^,]+,\d+,\d+,\d+,[BbNn]/.test(line)) return 'pplb';
    if (/^[1-4][0-9A-Za-z]\d{13}/.test(line)) return 'dpl';
  }
  return 'dpl';
}

/** Mapeia o código de barcode declarado em cada linguagem pra um tipo aceito pelo bwip-js. */
export function mapBarcodeSymbol(lang, symbol) {
  const s = String(symbol || '').toUpperCase();
  if (lang === 'zpl') {
    if (s === 'B3') return 'code39';
    if (s === 'BE') return 'ean13';
    if (s === 'BQ') return 'qrcode';
    if (s === 'B2') return 'interleaved2of5';
    return 'code128'; // BC e demais
  }
  if (lang === 'pplb') {
    if (s === '3') return 'code39';
    if (s === 'E' || s === 'EAN13') return 'ean13';
    if (s === 'Q') return 'qrcode';
    return 'code128';
  }
  // DPL: letras minúsculas/maiúsculas indicam simbologia; aproximação igual ao ETQ. Viewer original
  if (s === 'Q' || s === 'q') return 'qrcode';
  return 'code128';
}

// ============ DPL / PPLA (Argox/Datamax) ============
// coordSystem: 'bottom-left' -> xMM da esquerda, yMM de BAIXO
export function parseDPL(text) {
  const lines = text.split(/\r?\n/);
  const labels = [], log = [];
  let metric = false, colOff = 0, rowOff = 0, cur = null;

  const rawToMM = v => metric ? v / 10 : (v / 100) * 25.4;
  const ensureCur = () => { if (!cur) cur = { elements: [], widthMM: 0, heightMM: 0, coordSystem: 'bottom-left' }; };
  const pushCur = () => { if (cur) { labels.push(cur); cur = null; } };

  for (const raw0 of lines) {
    const line = stripCtrl(raw0).trim();
    if (!line) continue;

    if (/^[1-4]/.test(line) && line.length >= 15) {
      ensureCur();
      const a = line[0], b = line[1], c = line[2], d = line[3];
      const eee = line.substr(4, 3), ffff = line.substr(7, 4), gggg = line.substr(11, 4);
      const rest = line.substr(15);
      if (!/^\d{3}$/.test(eee) || !/^\d{4}$/.test(ffff) || !/^\d{4}$/.test(gggg)) {
        log.push({ status: 'warn', cmd: line.slice(0, 30), info: 'Cabeçalho inválido — ignorado' });
        continue;
      }
      const rot = (parseInt(a) - 1) * 90;
      const rowMM = rawToMM(parseInt(ffff) + rowOff), colMM = rawToMM(parseInt(gggg) + colOff);

      if (/[0-9]/.test(b)) {
        const fh = DPL_FONT_H[b] || 2.5;
        const hMul = multVal(d), wMul = multVal(c);
        cur.elements.push({ type: 'text', xMM: colMM, yMM: rowMM, rot, wMul, hMul, fontSizeMM: fh * hMul, text: rest });
        log.push({ status: 'ok', cmd: line.slice(0, 50), info: `Texto "${rest.slice(0, 30)}"` });
      } else if (/[A-Za-z]/.test(b)) {
        const heightMM = rawToMM(parseInt(eee));
        const narrowMM = multVal(d) * (metric ? 0.1 : 0.125), wideMM = multVal(c) * (metric ? 0.1 : 0.125);
        cur.elements.push({ type: 'barcode', xMM: colMM, yMM: rowMM, rot, narrowMM, wideMM, heightMM, humanReadable: /[A-Z]/.test(b), data: rest, symbol: b });
        log.push({ status: 'ok', cmd: line.slice(0, 50), info: `Barcode ${b} "${rest.slice(0, 20)}"` });
      } else if (b === 'X') {
        cur.elements.push({ type: 'graphic', xMM: colMM, yMM: rowMM, spec: rest });
        log.push({ status: 'warn', cmd: line.slice(0, 30), info: 'Gráfico — não importável, só log' });
      } else if (b === 'Y') {
        log.push({ status: 'warn', cmd: line.slice(0, 30), info: `Imagem "${rest}" — não importável` });
      } else {
        log.push({ status: 'warn', cmd: line.slice(0, 30), info: 'Campo não reconhecido' });
      }
      continue;
    }

    if (line === 'L') { pushCur(); cur = { elements: [], widthMM: 0, heightMM: 0, coordSystem: 'bottom-left' }; metric = false; colOff = rowOff = 0; log.push({ status: 'ok', cmd: 'L', info: 'Novo formato' }); continue; }
    if (line === 'E' || line === 'X') { ensureCur(); pushCur(); log.push({ status: 'ok', cmd: line, info: 'Fim' }); continue; }
    if (line === 'm') { metric = true; log.push({ status: 'ok', cmd: 'm', info: 'Modo métrico' }); continue; }
    if (line === 'n') { metric = false; log.push({ status: 'ok', cmd: 'n', info: 'Modo polegadas' }); continue; }

    let m;
    m = line.match(/^C(\d{4})$/);
    if (m) { colOff = parseInt(m[1]); log.push({ status: 'ok', cmd: line, info: `Offset coluna=${m[1]}` }); continue; }
    m = line.match(/^R(\d{4})$/);
    if (m) { rowOff = parseInt(m[1]); log.push({ status: 'ok', cmd: line, info: `Offset linha=${m[1]}` }); continue; }
    m = line.match(/^Q(\d{4})$/);
    if (m) { log.push({ status: 'ok', cmd: line, info: `Qtd=${m[1]}` }); continue; }
    if (/^(H\d|D\d|K|e$|r$)/.test(line)) { log.push({ status: 'ok', cmd: line.slice(0, 15), info: 'Config — ignorado' }); continue; }
    log.push({ status: 'warn', cmd: line.slice(0, 30), info: 'Não reconhecido (ignorado)' });
  }
  if (cur) pushCur();
  return { labels, log };
}

// ============ PPLB (Argox) ============
// coordSystem: 'top-left' -> xMM, yMM do TOPO-esquerda
export function parsePPLB(text) {
  const lines = text.split(/\r?\n/);
  const labels = [], log = [];
  let cur = null, gW = 0, gH = 0;

  const ensureCur = () => { if (!cur) cur = { elements: [], widthMM: gW, heightMM: gH, coordSystem: 'top-left' }; };
  const pushCur = () => { if (cur) { labels.push(cur); cur = null; } };

  for (const raw of lines) {
    const line = raw.trim().replace(/\t+/g, ' ');
    if (!line || line.startsWith(';')) continue;

    let m;
    if (line === 'N') { pushCur(); cur = { elements: [], widthMM: gW, heightMM: gH, coordSystem: 'top-left' }; log.push({ status: 'ok', cmd: 'N', info: 'Novo buffer' }); continue; }
    if (/^r[A-Z]?$/.test(line) || line === 'rN') { log.push({ status: 'ok', cmd: line, info: 'Reset/sensor — ignorado' }); continue; }
    m = line.match(/^q(\d+)/i);
    if (m) { gW = parseInt(m[1]) / DOTS_PER_MM; if (cur) cur.widthMM = gW; log.push({ status: 'ok', cmd: line, info: `Largura=${gW.toFixed(1)}mm` }); continue; }
    m = line.match(/^Q(\d+),(\d+)/);
    if (m) { gH = parseInt(m[1]) / DOTS_PER_MM; if (cur) cur.heightMM = gH; log.push({ status: 'ok', cmd: line, info: `Altura=${gH.toFixed(1)}mm` }); continue; }
    m = line.match(/^P(\d+)/);
    if (m) { pushCur(); log.push({ status: 'ok', cmd: line, info: `Imprimir ${m[1]} cópia(s)` }); continue; }
    if (/^[SD]\d|^Z[TB]$/.test(line)) { log.push({ status: 'ok', cmd: line, info: 'Config — ignorado' }); continue; }

    ensureCur();

    m = line.match(/^[Aa](\d+),(\d+),(\d+),(\d+),(\d+),(\d+),([NRnr]),"(.*?)"/) ||
        line.match(/^[Aa](\d+),(\d+),(\d+),(\d+),(\d+),(\d+),([NRnr]),(.*)/);
    if (m) {
      const [, x, y, rot, font, hmul, vmul, rev, text] = m;
      const fh = PPLB_FONT_H[parseInt(font)] || 2.5;
      cur.elements.push({
        type: 'text', xMM: parseInt(x) / DOTS_PER_MM, yMM: parseInt(y) / DOTS_PER_MM,
        rot: parseInt(rot) * 90, wMul: parseInt(hmul), hMul: parseInt(vmul),
        fontSizeMM: fh * parseInt(vmul), reverse: rev.toUpperCase() === 'R', text: text || ''
      });
      log.push({ status: 'ok', cmd: line.slice(0, 50), info: `Texto "${(text || '').slice(0, 30)}"` });
      continue;
    }

    m = line.match(/^[Bb](\d+),(\d+),(\d+),([^,]+),(\d+),(\d+),(\d+),([BbNn]),"(.*?)"/) ||
        line.match(/^[Bb](\d+),(\d+),(\d+),([^,]+),(\d+),(\d+),(\d+),([BbNn]),(.*)/);
    if (m) {
      const [, x, y, rot, btype, narrow, wide, height, hr, data] = m;
      cur.elements.push({
        type: 'barcode', xMM: parseInt(x) / DOTS_PER_MM, yMM: parseInt(y) / DOTS_PER_MM,
        rot: parseInt(rot) * 90, symbol: btype,
        narrowMM: parseInt(narrow) / DOTS_PER_MM, wideMM: parseInt(wide) / DOTS_PER_MM,
        heightMM: parseInt(height) / DOTS_PER_MM, humanReadable: hr.toUpperCase() === 'B', data: data || ''
      });
      log.push({ status: 'ok', cmd: line.slice(0, 50), info: `Barcode ${btype} "${(data || '').slice(0, 20)}"` });
      continue;
    }

    log.push({ status: 'warn', cmd: line.slice(0, 40), info: 'Não reconhecido (ignorado)' });
  }
  if (cur) pushCur();
  return { labels, log };
}

// ============ ZPL (Zebra / Elgin) ============
// coordSystem: 'top-left' -> xMM, yMM do TOPO-esquerda
export function parseZPL(text) {
  const log = [], labels = [];
  let cur = null, curX = 0, curY = 0;
  let curFontH = 20, curFontXScale = 0.88; // CG Triumvirate ≈ 88% de Arial p/ mesma altura
  let curBarNarrow = 2, curBarRatio = 3.0, curBarH = 40;
  let pendingBar = null;

  const ensureCur = () => { if (!cur) cur = { elements: [], widthMM: 0, heightMM: 0, coordSystem: 'top-left' }; };
  const pushCur = () => { if (cur) { labels.push(cur); cur = null; } };

  const tokens = text.replace(/\r?\n/g, ' ').split('^').map(t => t.trim()).filter(Boolean);

  for (const tok of tokens) {
    const cmd = tok.substr(0, 2).toUpperCase();
    const params = tok.substr(2).trim();

    if (cmd === 'XA') { pushCur(); cur = { elements: [], widthMM: 0, heightMM: 0, coordSystem: 'top-left' }; log.push({ status: 'ok', cmd: '^XA', info: 'Início de etiqueta' }); continue; }
    if (cmd === 'XZ') { pushCur(); log.push({ status: 'ok', cmd: '^XZ', info: 'Fim de etiqueta' }); continue; }

    ensureCur();

    if (cmd === 'FO' || cmd === 'FT') {
      const p = params.split(','); curX = parseInt(p[0]) || 0; curY = parseInt(p[1]) || 0;
      log.push({ status: 'ok', cmd: `^${cmd}${params.slice(0, 20)}`, info: `Origem: x=${curX}, y=${curY}` }); continue;
    }

    if (cmd === 'FD') {
      const txt = params.replace(/FS\s*$/i, '').trim();
      if (pendingBar) {
        pendingBar.data = txt; cur.elements.push(pendingBar);
        log.push({ status: 'ok', cmd: '^FD', info: `Barcode "${txt.slice(0, 20)}"` });
        pendingBar = null;
      } else if (txt) {
        cur.elements.push({
          type: 'text', xMM: curX / DOTS_PER_MM, yMM: curY / DOTS_PER_MM,
          rot: 0, wMul: 1, hMul: 1, xScale: curFontXScale, fontSizeMM: curFontH / DOTS_PER_MM, text: txt
        });
        log.push({ status: 'ok', cmd: '^FD', info: `Texto "${txt.slice(0, 30)}"` });
      }
      continue;
    }

    if (cmd === 'FS') continue;

    if (cmd === 'BY') {
      const p = params.split(','); curBarNarrow = parseInt(p[0]) || 2; curBarRatio = parseFloat(p[1]) || 3.0; curBarH = parseInt(p[2]) || 40;
      log.push({ status: 'ok', cmd: `^BY${params.slice(0, 20)}`, info: `Barcode cfg: narrow=${curBarNarrow}, h=${curBarH}` }); continue;
    }

    if (cmd === 'LL') { const h = parseInt(params) || 0; if (cur) cur.heightMM = h / DOTS_PER_MM; log.push({ status: 'ok', cmd: `^LL${params}`, info: `Altura=${(h / DOTS_PER_MM).toFixed(1)}mm` }); continue; }
    if (cmd === 'PW') { const w = parseInt(params) || 0; if (cur) cur.widthMM = w / DOTS_PER_MM; log.push({ status: 'ok', cmd: `^PW${params}`, info: `Largura=${(w / DOTS_PER_MM).toFixed(1)}mm` }); continue; }
    if (cmd === 'PQ') { log.push({ status: 'ok', cmd: `^PQ${params.slice(0, 10)}`, info: `Qtd: ${params.split(',')[0]}` }); continue; }
    if (/^(CF|LH|MN|MM|MD|MP|CI|FW|IS)$/.test(cmd)) { log.push({ status: 'ok', cmd: `^${cmd}${params.slice(0, 10)}`, info: 'Config — ignorado' }); continue; }

    if (cmd === 'GB') {
      const p = params.split(','); const ww = parseInt(p[0]) || 10, hh = parseInt(p[1]) || 10, th = parseInt(p[2]) || 1;
      cur.elements.push({ type: 'box', xMM: curX / DOTS_PER_MM, yMM: curY / DOTS_PER_MM, wMM: ww / DOTS_PER_MM, hMM: hh / DOTS_PER_MM, thickMM: th / DOTS_PER_MM });
      log.push({ status: 'ok', cmd: `^GB${params.slice(0, 20)}`, info: `Caixa ${ww}x${hh} dots` }); continue;
    }

    if (cmd[0] === 'A' && /[0-9A-Z]/.test(cmd[1])) {
      const fm = tok.match(/^A([0-9A-Z])([NRIB]?),?(\d*),?(\d*)/i);
      if (fm) {
        curFontH = parseInt(fm[3]) || 20;
        const curFontW = parseInt(fm[4]) || 0;
        const ratio = curFontW > 0 ? curFontW / curFontH : 1.0;
        curFontXScale = ratio * 0.88;
        log.push({ status: 'ok', cmd: `^A${tok.substr(1, 12)}`, info: `Fonte ${fm[1]}, h=${curFontH}` });
      }
      continue;
    }

    if (cmd[0] === 'B' && /[0-9A-Z]/.test(cmd[1])) {
      const p = params.split(','); const bh = parseInt(p[2]) || curBarH; const hr = (p[3] || 'Y').toUpperCase() !== 'N';
      pendingBar = {
        type: 'barcode', xMM: curX / DOTS_PER_MM, yMM: curY / DOTS_PER_MM, rot: 0, symbol: cmd,
        narrowMM: curBarNarrow / DOTS_PER_MM, wideMM: (curBarNarrow * curBarRatio) / DOTS_PER_MM,
        heightMM: bh / DOTS_PER_MM, humanReadable: hr, data: ''
      };
      log.push({ status: 'ok', cmd: `^${cmd}${params.slice(0, 20)}`, info: `Barcode ${cmd}, h=${bh} dots` }); continue;
    }

    log.push({ status: 'warn', cmd: `^${tok.slice(0, 8)}`, info: 'Cmd não reconhecido (ignorado)' });
  }
  if (cur) pushCur();
  return { labels, log };
}

/** Dispatcher único: parseia conforme a linguagem (ou auto-detecta). */
export function parseLabelCode(text, language = 'auto') {
  const lang = language === 'auto' ? detectLanguage(text) : language;
  const result = lang === 'pplb' ? parsePPLB(text) : lang === 'zpl' ? parseZPL(text) : parseDPL(text);
  return { ...result, detectedLang: lang };
}

/** Estima largura/altura (mm) de uma label quando o código não declarou. */
export function computeBoundsMM(label) {
  let maxX = 10, maxY = 10;
  for (const el of label.elements) {
    if (el.type === 'text') {
      const approxW = (el.text || '').length * (el.fontSizeMM || 2.5) * 0.55 * (el.wMul || 1);
      maxX = Math.max(maxX, el.xMM + approxW);
      maxY = Math.max(maxY, el.yMM + (el.fontSizeMM || 2.5) + 2);
    } else if (el.type === 'barcode') {
      const approxW = (el.data || '').length * 1.5 * (el.wMul || 1);
      maxX = Math.max(maxX, el.xMM + approxW);
      maxY = Math.max(maxY, el.yMM + (el.heightMM || 10) + 7);
    } else if (el.type === 'box') {
      maxX = Math.max(maxX, el.xMM + (el.wMM || 10));
      maxY = Math.max(maxY, el.yMM + (el.hMM || 10));
    }
  }
  return { width: Math.ceil(maxX + 5), height: Math.ceil(maxY + 5) };
}
