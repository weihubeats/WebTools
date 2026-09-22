/* JSON 格式化工具：纯原生 JS，无依赖
 * 约定：左侧输入永远不被改写，所有格式化/压缩/转义结果只渲染到右侧。
 * 无任何操作通知弹框：成功静默，失败直接在右侧显示错误 + 状态栏标红。
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const input = $("json-input");
  const hl = $("json-input-hl");
  const output = $("json-output");
  const treeEl = $("json-tree");
  const LS_KEY = "webtools.json.input.v1";
  const LAYOUT_KEY = "webtools.json.layout.v1";
  const SYNC_KEY = "webtools.json.sync-scroll.v1";

  let lastDocs = null;  // 最后一次解析成功的文档数组（单段时长度为 1）
  let lastText = "";    // 最后一次输出文本
  let layoutMode = "single";
  let syncEnabled = true;
  let syncScrolling = false;

  // ---------- 基础函数 ----------
  function getIndent() {
    const v = $("sel-indent").value;
    if (v === "tab") return "\t";
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? " ".repeat(n) : null; // null = 压缩
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 从错误信息中提取 position，并换算出行列（供错误卡片展示）
  function getErrorInfo(e, text) {
    const raw = (e && e.message) || String(e);
    const m = /position\s+(\d+)/i.exec(raw);
    if (!m) return { raw, pos: null };
    const pos = Math.min(parseInt(m[1], 10), text.length);
    const upto = text.slice(0, pos);
    const line = upto.split("\n").length;
    const col = pos - upto.lastIndexOf("\n");
    return { raw, pos, line, col };
  }

  // ---------- 多段 JSON：一次输入里连续排布的多个独立 JSON 值 ----------
  // 支持 NDJSON（一行一个）、直接首尾相接（}{）、以及段间用 , / ; 分隔的粘贴片段
  const MAX_DOCS = 5000;
  const PRIMITIVE_RE = /(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;

  // 从 i 处扫描一个完整 JSON 值的结束位置（不含），失败返回 -1
  function scanValueEnd(text, i) {
    const c = text[i];
    if (c === "{" || c === "[") {
      const stack = [c === "{" ? "}" : "]"];
      let inStr = false, escNext = false;
      for (let j = i + 1; j < text.length; j++) {
        const ch = text[j];
        if (inStr) {
          if (escNext) escNext = false;
          else if (ch === "\\") escNext = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") {
          if (stack.pop() !== ch) return -1;
          if (!stack.length) return j + 1;
        }
      }
      return -1;
    }
    if (c === '"') {
      let escNext = false;
      for (let j = i + 1; j < text.length; j++) {
        const ch = text[j];
        if (escNext) escNext = false;
        else if (ch === "\\") escNext = true;
        else if (ch === '"') return j + 1;
      }
      return -1;
    }
    PRIMITIVE_RE.lastIndex = i;
    const m = PRIMITIVE_RE.exec(text);
    return m ? i + m[0].length : -1;
  }

  // 切分并逐段 JSON.parse；任一段非法或超出上限则返回 null
  function splitJsonDocs(text) {
    const docs = [];
    const n = text.length;
    let i = 0;
    let prevClosed = true; // 上一段以 } ] " 收尾（自带边界）
    while (i < n) {
      let sep = false;
      while (i < n) {
        const c = text[i];
        if (/\s/.test(c)) { sep = true; i++; continue; }
        if (docs.length && (c === "," || c === ";")) { sep = true; i++; continue; }
        break;
      }
      if (i >= n) break;
      // 裸字面量后面必须有分隔符，否则 2026-09-10 这类文本会被误切成 2026 / -9 / -10
      if (docs.length && !sep && !prevClosed) return null;
      const end = scanValueEnd(text, i);
      if (end < 0) return null;
      const slice = text.slice(i, end);
      try { docs.push(JSON.parse(slice)); } catch (_) { return null; }
      if (docs.length > MAX_DOCS) return null;
      const tail = slice[slice.length - 1];
      prevClosed = tail === "}" || tail === "]" || tail === '"';
      i = end;
    }
    return docs.length ? docs : null;
  }

  // 解析成功返回文档数组，失败返回 null（不抛异常，供自动修复等场景试探）
  function tryParseDocs(text) {
    const t = String(text == null ? "" : text).trim();
    if (!t) return null;
    try { return [JSON.parse(t)]; } catch (_) { /* 落到多段解析 */ }
    const docs = splitJsonDocs(t);
    return docs && docs.length > 1 ? docs : null;
  }

  // 左侧输入 -> 文档数组；单段整体非法时抛出原生错误（保留 position 便于定位）
  function parseInput() {
    const text = input.value.trim();
    if (!text) throw new Error("输入为空，请粘贴 JSON 后再试。");
    try { return [JSON.parse(text)]; } catch (e) {
      const docs = splitJsonDocs(text);
      if (docs && docs.length > 1) return docs;
      throw e;
    }
  }

  // 多段之间：压缩用换行（NDJSON），美化用空行，便于肉眼分段
  function stringifyDocs(docs, indent) {
    const one = (v) => (indent === null ? JSON.stringify(v) : JSON.stringify(v, null, indent));
    return docs.map(one).join(indent === null ? "\n" : "\n\n");
  }

  function okStatus(docs) {
    return docs.length > 1 ? `✅ 有效 JSON · 共 ${docs.length} 段` : "✅ 有效 JSON";
  }

  // 展开字符串值里嵌套的转义 JSON：{"a":"{\"b\":1}"} -> {"a":{"b":1}}
  // 深度/长度上限防病态输入；解析失败保留原字符串
  const MAX_NEST_DEPTH = 20;
  function expandNestedJson(value, depth) {
    depth = depth || 0;
    if (depth > MAX_NEST_DEPTH) return value;
    if (Array.isArray(value)) return value.map((v) => expandNestedJson(v, depth + 1));
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((k) => { out[k] = expandNestedJson(value[k], depth + 1); });
      return out;
    }
    if (typeof value === "string") {
      const t = value.trim();
      if ((t[0] === "{" || t[0] === "[") && t.length <= 200000) {
        try { return expandNestedJson(JSON.parse(t), depth + 1); } catch (_) { /* 非法则保留 */ }
      }
    }
    return value;
  }

  // 格式化入口统一走这里：解析 + 展开嵌套转义
  function parseAndExpand() {
    return parseInput().map((d) => expandNestedJson(d));
  }

  function sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach((k) => { out[k] = sortKeysDeep(value[k]); });
      return out;
    }
    return value;
  }

  function getDepthAndKeys(value) {
    let maxDepth = 0, keys = 0;
    (function walk(v, d) {
      maxDepth = Math.max(maxDepth, d);
      if (Array.isArray(v)) v.forEach((x) => walk(x, d + 1));
      else if (v && typeof v === "object") {
        keys += Object.keys(v).length;
        Object.values(v).forEach((x) => walk(x, d + 1));
      }
    })(value, 1);
    return { maxDepth, keys };
  }

  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "Array";
    return typeof v === "object" ? "Object" : typeof v;
  }

  // 状态栏统计：多段时深度取最大值、键数取总和
  function docsStats(docs) {
    let maxDepth = 0, keys = 0;
    docs.forEach((d) => {
      const r = getDepthAndKeys(d);
      maxDepth = Math.max(maxDepth, r.maxDepth);
      keys += r.keys;
    });
    return { maxDepth, keys };
  }

  function docsType(docs) {
    if (docs.length === 1) return typeOf(docs[0]);
    const kinds = [...new Set(docs.map(typeOf))];
    return `${docs.length} 段 · ${kinds.join(" / ")}`;
  }

  // ---------- 高亮（支持转义字符串，左右两侧复用） ----------
  // 对原始 JSON 文本做词法级高亮，先分词再转义，避免 &quot; 这类误匹配
  function highlight(json) {
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(json)) !== null) {
      out += esc(json.slice(last, m.index));
      const tok = m[0];
      if (tok[0] === '"') {
        const str = m[1];
        const colon = m[2];
        const htmlStr = `<span class="tok-str">${esc(str)}</span>`;
        out += colon
          ? htmlStr.replace('tok-str', 'tok-key') + `<span class="tok-punc">${esc(colon)}</span>`
          : htmlStr;
        // 上面把 key 和 string 区分：带冒号的是 key
        // 注意 replace 只替换 class 名，内容已转义
      } else if (tok === "true" || tok === "false") {
        out += `<span class="tok-bool">${tok}</span>`;
      } else if (tok === "null") {
        out += `<span class="tok-null">null</span>`;
      } else {
        out += `<span class="tok-num">${esc(tok)}</span>`;
      }
      last = m.index + tok.length;
    }
    out += esc(json.slice(last));
    // 标点（括号冒号逗号）着色：不能破坏已生成的 span，所以只处理纯文本段？
    // 简单起见，标点保持默认色，已足够清晰；key/str/num/bool/null 已高对比。
    return out;
  }

  // 输入框语法高亮：textarea 无法着色，用底层 <pre> 叠加实现
  // 搜索打开时叠加 mark 标记；scrollCur=true 才把当前命中滚入视野（打字时不抢滚动）
  function renderInputHighlight(scrollCur) {
    const text = input.value;
    if (!text) { hl.innerHTML = ""; return; }
    if (leftSearch.open && leftSearch.query) {
      refreshLeftMatches();
      hl.innerHTML = markMatches(text, leftSearch.matches, leftSearch.idx) + "\n";
      if (scrollCur && leftSearch.matches.length) {
        const wrap = hl.parentElement;
        const v = calcMarkScroll(wrap, hl);
        if (v !== null) { input.scrollTop = v; hl.scrollTop = v; return; }
      }
    } else {
      hl.innerHTML = highlight(text) + "\n";
      $("search-count-left").textContent = "";
    }
    hl.scrollTop = input.scrollTop;
  }
  function syncHlPadding() {
    hl.style.paddingRight = (12 + (input.offsetWidth - input.clientWidth)) + "px";
  }

  // ---------- 右侧渲染 ----------
  function showTextTab() {
    $("tab-text").classList.add("active"); $("tab-tree").classList.remove("active");
    output.hidden = false; treeEl.hidden = true;
  }

  // ---------- 多报文对比布局 ----------
  function compareOptionLabel(value, i) {
    let detail = typeOf(value);
    if (Array.isArray(value)) detail += `(${value.length})`;
    else if (value && typeof value === "object") detail += `{${Object.keys(value).length}}`;
    return `#${i + 1} · ${detail}`;
  }

  function populateCompareSelect(select, preferred) {
    select.innerHTML = "";
    (lastDocs || []).forEach((value, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = compareOptionLabel(value, i);
      select.appendChild(option);
    });
    const max = Math.max(0, (lastDocs || []).length - 1);
    select.value = String(Math.min(Math.max(preferred, 0), max));
    select.disabled = !lastDocs || lastDocs.length < 2;
  }

  function renderComparePanel(side) {
    const code = $("compare-code-" + side);
    const select = $("compare-select-" + side);
    if (!lastDocs || lastDocs.length < 2) {
      code.className = "compare-code placeholder";
      code.textContent = lastDocs
        ? "当前只有 1 段 JSON，请切回单栏并再粘贴一段。"
        : "请切回单栏，输入至少两段有效 JSON 后开始对比。";
      return;
    }
    const idx = Math.min(parseInt(select.value, 10) || 0, lastDocs.length - 1);
    const indent = getIndent() || "  "; // 对比模式始终保留结构，便于逐行查看
    const text = JSON.stringify(lastDocs[idx], null, indent);
    code.className = "compare-code";
    code.innerHTML = highlight(text);
  }

  function renderCompare() {
    if (layoutMode === "single") return;
    const a = $("compare-select-a");
    const b = $("compare-select-b");
    const oldA = parseInt(a.value, 10);
    const oldB = parseInt(b.value, 10);
    populateCompareSelect(a, Number.isFinite(oldA) ? oldA : 0);
    populateCompareSelect(b, Number.isFinite(oldB) ? oldB : 1);
    // 初次进入时默认比较前两段，后续重新渲染保留用户选择
    if (lastDocs && lastDocs.length > 1 && !Number.isFinite(oldB)) b.value = "1";
    renderComparePanel("a");
    renderComparePanel("b");
  }

  function setLayout(mode, persist) {
    if (!["single", "horizontal", "vertical"].includes(mode)) mode = "single";
    layoutMode = mode;
    $("json-layout").dataset.layout = mode;
    document.querySelectorAll("[data-layout]").forEach((btn) => {
      if (!btn.classList.contains("json-layout")) {
        const active = btn.dataset.layout === mode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
    });
    const comparing = mode !== "single";
    $("sync-scroll-control").hidden = !comparing;
    $("json-compare").hidden = !comparing;
    $("json-compare").className = "json-compare" + (comparing ? ` layout-${mode}` : "");
    ["tab-text", "tab-tree", "btn-search-right", "btn-expand-all", "btn-collapse-all"]
      .forEach((id) => { $(id).disabled = comparing; });
    if (comparing) {
      output.hidden = true;
      treeEl.hidden = true;
      $("searchbar-right").hidden = true;
      renderCompare();
    } else if ($("tab-tree").classList.contains("active")) {
      output.hidden = true;
      treeEl.hidden = false;
    } else {
      output.hidden = false;
      treeEl.hidden = true;
    }
    if (persist !== false) {
      try { localStorage.setItem(LAYOUT_KEY, mode); } catch (_) {}
    }
  }

  function syncCompareScroll(source, target) {
    if (!syncEnabled || syncScrolling) return;
    syncScrolling = true;
    const sourceY = source.scrollHeight - source.clientHeight;
    const targetY = target.scrollHeight - target.clientHeight;
    const sourceX = source.scrollWidth - source.clientWidth;
    const targetX = target.scrollWidth - target.clientWidth;
    target.scrollTop = sourceY > 0 ? (source.scrollTop / sourceY) * targetY : 0;
    target.scrollLeft = sourceX > 0 ? (source.scrollLeft / sourceX) * targetX : 0;
    requestAnimationFrame(() => { syncScrolling = false; });
  }

  let lastPlain = false; // 最后一次渲染是否为单行 plain（压缩结果恢复用）

  function render(text, docs, opts) {
    lastText = text;
    lastDocs = docs;
    lastPlain = !!(opts && opts.plain);
    output.classList.remove("placeholder");
    if (!opts || !opts.keepTab) showTextTab();
    renderFoldableOutput(text, docs, opts);
    renderTree(docs);
    $("st-output").textContent = text.length;
    $("st-type").textContent = docsType(docs);
    const { maxDepth, keys } = docsStats(docs);
    $("st-depth").textContent = maxDepth;
    $("st-keys").textContent = keys;
    // 右侧搜索打开时，重新格式化会抹掉扁平搜索视图，在此恢复
    if (rightSearch.open && rightSearch.query && lastText) renderSearchRight(false);
    renderCompare();
  }

  // 右侧错误卡片：标题 + 原生报错 + 行列 + 自动修复按钮
  function renderError(e) {
    lastText = "";
    lastDocs = null;
    output.classList.remove("placeholder");
    const info = getErrorInfo(e, input.value);
    const posHtml = info.pos !== null
      ? `<div class="j-err-pos">第 ${info.line} 行，第 ${info.col} 列</div>`
      : "";
    output.innerHTML =
      `<div class="j-err-card" role="alert">` +
      `<div class="j-err-title"><span class="j-err-icon" aria-hidden="true">` +
      `<svg width="22" height="22" viewBox="0 0 22 22" fill="none">` +
      `<circle cx="11" cy="11" r="9.2" stroke="#d41f3c" stroke-width="1.8"/>` +
      `<line x1="11" y1="6.4" x2="11" y2="12" stroke="#d41f3c" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="11" cy="15" r="1.3" fill="#d41f3c"/></svg></span>JSON 格式有误</div>` +
      `<div class="j-err-msg">${esc(info.raw)}</div>` +
      posHtml +
      `<button class="j-fix-btn" type="button">🪄 尝试自动修复</button>` +
      `<div class="j-fix-fail" hidden></div>` +
      `</div>`;
    treeEl.innerHTML = "";
    $("st-status").textContent = "❌ 无效";
    $("st-output").textContent = "0";
    $("st-type").textContent = "-";
    $("st-depth").textContent = "-";
    $("st-keys").textContent = "-";
    const btn = output.querySelector(".j-fix-btn");
    if (btn) btn.addEventListener("click", doAutoFix);
    renderCompare();
  }

  // ---------- 自动修复：依次尝试常见修复，每步都用 JSON.parse 校验 ----------
  // 字符串感知分段：把单/双引号字面量与代码区分开，正则只作用于代码段
  function scanSegments(text) {
    const segs = [];
    let i = 0, n = text.length, buf = "", inStr = false, q = "";
    while (i < n) {
      const c = text[i];
      if (!inStr) {
        if (c === '"' || c === "'") {
          if (buf) { segs.push({ s: false, t: buf }); buf = ""; }
          inStr = true; q = c; buf = c; i++;
        } else { buf += c; i++; }
      } else {
        buf += c;
        if (c === "\\") { if (i + 1 < n) { buf += text[i + 1]; i += 2; } else { i++; } }
        else if (c === q) { i++; segs.push({ s: true, t: buf, q }); buf = ""; inStr = false; q = ""; }
        else if (c === "\n" || c === "\r") {
          // 字符串内出现原始换行：算作“破裂”，换行符退回按代码处理
          segs.push({ s: true, t: buf.slice(0, -1), q, broken: true });
          buf = ""; inStr = false; q = "";
        }
        else { i++; }
      }
    }
    if (buf) segs.push({ s: inStr, t: buf, q: inStr ? q : "" });
    return segs;
  }

  // 修复1：字符串内的原始控制字符做转义，代码区的杂散控制字符丢弃
  function fixControlChars(text) {
    let out = "", inStr = false, q = "", changed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (!inStr) {
        if (c === '"' || c === "'") { inStr = true; q = c; out += c; }
        else {
          const code = c.charCodeAt(0);
          if (code < 0x20 && c !== " " && c !== "\t" && c !== "\n" && c !== "\r") changed = true;
          else out += c;
        }
      } else {
        if (c === "\\") { out += c; if (i + 1 < text.length) out += text[++i]; }
        else if (c === q) { inStr = false; q = ""; out += c; }
        else {
          const code = c.charCodeAt(0);
          if (code < 0x20) {
            changed = true;
            out += c === "\b" ? "\\b" : c === "\f" ? "\\f" : c === "\n" ? "\\n"
              : c === "\r" ? "\\r" : c === "\t" ? "\\t"
              : "\\u" + code.toString(16).padStart(4, "0");
          } else out += c;
        }
      }
    }
    return changed ? out : text;
  }

  // 修复2：去掉尾随逗号（, } / , ]）
  function stripTrailingCommas(text) {
    const segs = scanSegments(text);
    let changed = false;
    const out = segs.map((sg) => {
      if (sg.s) return sg.t;
      let t = sg.t, prev;
      do { prev = t; t = t.replace(/,\s*([}\]])/g, "$1"); } while (t !== prev);
      if (t !== sg.t) changed = true;
      return t;
    }).join("");
    return changed ? out : text;
  }

  function convertSingleInner(inner) {
    let out = "";
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === "\\" && i + 1 < inner.length) {
        const d = inner[++i];
        if (d === "'") out += "'";
        else out += "\\" + d;
      }
      else if (c === '"') out += '\\"';
      else if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else {
        const code = c.charCodeAt(0);
        out += code < 0x20 ? "\\u" + code.toString(16).padStart(4, "0") : c;
      }
    }
    return '"' + out + '"';
  }

  // 修复3：单引号字符串转双引号
  function singleToDouble(text) {
    const segs = scanSegments(text);
    let changed = false;
    const out = segs.map((sg) => {
      if (!sg.s || sg.q !== "'") return sg.t;
      changed = true;
      let inner = sg.t.slice(1);
      if (inner.endsWith("'")) inner = inner.slice(0, -1);
      return convertSingleInner(inner);
    }).join("");
    return changed ? out : text;
  }

  // 修复4：未加引号的对象键加引号
  function quoteKeys(text) {
    const segs = scanSegments(text);
    let changed = false;
    const out = segs.map((sg) => {
      if (sg.s) return sg.t;
      const t = sg.t.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
      if (t !== sg.t) changed = true;
      return t;
    }).join("");
    return changed ? out : text;
  }

  // 修复5：补全缺失的引号 / 括号
  function balanceBrackets(text) {
    const stack = [];
    let inStr = false, escNext = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (escNext) escNext = false;
        else if (c === "\\") escNext = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === "{") stack.push("}");
        else if (c === "[") stack.push("]");
        else if (c === "}" || c === "]") {
          if (!stack.length || stack[stack.length - 1] !== c) return null;
          stack.pop();
        }
      }
    }
    if (!stack.length && !inStr) return text;
    if (stack.length > 24) return null;
    let suffix = inStr ? '"' : "";
    for (let i = stack.length - 1; i >= 0; i--) suffix += stack[i];
    return text + suffix;
  }

  function tryAutoFix(text) {
    const applied = [];
    const steps = [
      ["控制字符", fixControlChars],
      ["尾随逗号", stripTrailingCommas],
      ["单引号", singleToDouble],
      ["未加引号的键", quoteKeys],
    ];
    let cur = text;
    for (const [name, fn] of steps) {
      let next;
      try { next = fn(cur); } catch (_) { continue; }
      if (next && next !== cur) {
        cur = next;
        const docs = tryParseDocs(cur);
        if (docs) return { docs, applied: [...applied, name] };
        applied.push(name);
      }
    }
    try {
      const balanced = balanceBrackets(cur);
      if (balanced && balanced !== text) {
        const docs = tryParseDocs(balanced);
        if (docs) return { docs, applied: [...applied, "括号补全"] };
      }
    } catch (_) { /* 仍失败则返回 null */ }
    return null;
  }

  // 自动修复按钮：成功则把修复结果写回左侧并渲染右侧，失败则在卡片内 inline 提示
  function doAutoFix(ev) {
    const btn = (ev && (ev.currentTarget || ev.target)) || null;
    const failEl = output.querySelector(".j-fix-fail");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ 修复中…"; }
    let result = null;
    try { result = tryAutoFix(input.value); } catch (_) { result = null; }
    if (result) {
      const pretty = stringifyDocs(result.docs, getIndent());
      input.value = pretty; // 用户主动点的修复，允许写回左侧
      updateInputCount(); renderInputHighlight(); save();
      render(pretty, result.docs);
      $("st-status").textContent = "✨ 已自动修复" + (result.applied.length ? "：" + result.applied.join("、") : "");
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = "🪄 尝试自动修复"; }
    if (failEl && failEl.hidden !== undefined) {
      failEl.hidden = false;
      failEl.textContent = "自动修复失败，请根据上方位置手动修改。";
    }
  }

  // 右侧文本视图：可折叠高亮视图（大文件降级为纯高亮 pre）
  // opts.plain=true 时强制单行 plain 显示（压缩结果不受缩进下拉框影响）
  function renderFoldableOutput(text, docs, opts) {
    output.innerHTML = "";
    const plain = (opts && opts.plain) || getIndent() === null;
    const allPrimitive = docs.every((v) => v === null || typeof v !== "object");
    // 压缩模式 / 原始类型 / 超大文本：降级为普通高亮块，不做折叠（避免 DOM 爆炸）
    if (plain || allPrimitive || text.length > 500000) {
      const pre = document.createElement("pre");
      pre.className = "j-plain";
      pre.innerHTML = highlight(text);
      output.appendChild(pre);
      return;
    }
    const indent = getIndent();
    const indentStr = indent === "\t" ? "\t" : indent;
    docs.forEach((v, i) => {
      if (docs.length > 1) output.appendChild(docLabel(i, docs.length, v));
      output.appendChild(buildFoldNode(v, 0, indentStr, true));
    });
  }

  // 多段时的分段标题：#序号 / 总数 + 类型，帮助定位是第几段
  function docLabel(i, total, value) {
    const el = document.createElement("div");
    el.className = "j-doc-sep" + (i === 0 ? " first" : "");
    el.innerHTML = `<span class="j-doc-idx">#${i + 1} / ${total}</span>` +
      `<span class="j-doc-meta">${esc(typeOf(value))}</span>`;
    return el;
  }

  function leafSpan(v) {
    if (v === null) return `<span class="tok-null">null</span>`;
    const t = typeof v;
    if (t === "string") return `<span class="tok-str">${esc(JSON.stringify(v))}</span>`;
    if (t === "number") return `<span class="tok-num">${esc(String(v))}</span>`;
    if (t === "boolean") return `<span class="tok-bool">${esc(String(v))}</span>`;
    return esc(String(v));
  }

  // 递归构建可折叠节点；isLast 控制逗号
  function buildFoldNode(value, depth, indentStr, isLast) {
    const comma = isLast ? "" : `<span class="tok-punc">,</span>`;
    if (value !== null && typeof value === "object") {
      const isArr = Array.isArray(value);
      const entries = isArr ? value.map((v, i) => [null, v]) : Object.entries(value);
      const open = isArr ? "[" : "{";
      const close = isArr ? "]" : "}";
      if (entries.length === 0) {
        const div = document.createElement("div");
        div.className = "j-line";
        div.innerHTML = `<span class="tok-punc">${open}${close}</span>${comma}`;
        return div;
      }
      const node = document.createElement("div");
      node.className = "j-node";
      node.dataset.depth = depth;

      const head = document.createElement("div");
      head.className = "j-head";
      head.title = "点击折叠 / 展开";
      const label = isArr ? `Array(${entries.length})` : `Object{${entries.length}}`;
      head.innerHTML =
        `<span class="j-toggle">▾</span>` +
        `<span class="tok-punc">${open}</span>` +
        `<span class="j-preview" hidden><span class="tok-punc">${isArr ? "[…]" : "{…}"}</span> <span class="j-count">${esc(label)}</span><span class="tok-punc">${close}</span>${comma}</span>`;
      head.addEventListener("click", (ev) => {
        ev.stopPropagation();
        node.classList.toggle("collapsed");
        const collapsed = node.classList.contains("collapsed");
        head.querySelector(".j-toggle").textContent = collapsed ? "▸" : "▾";
        head.querySelector(".j-preview").hidden = !collapsed;
        body.hidden = collapsed;
        foot.hidden = collapsed;
      });

      const body = document.createElement("div");
      body.className = "j-body";
      const cap = 2000; // 文本视图每层上限，避免卡死
      entries.slice(0, cap).forEach(([k, v], idx) => {
        const last = idx === Math.min(cap, entries.length) - 1 && entries.length <= cap;
        const row = document.createElement("div");
        row.className = "j-row";
        if (v !== null && typeof v === "object") {
          const keyHtml = k === null ? "" : `<span class="tok-key">${esc(JSON.stringify(k))}</span><span class="tok-punc">: </span>`;
          const keySpan = document.createElement("span");
          keySpan.innerHTML = keyHtml;
          row.appendChild(keySpan);
          row.appendChild(buildFoldNode(v, depth + 1, indentStr, last));
        } else {
          const keyHtml = k === null ? "" : `<span class="tok-key">${esc(JSON.stringify(k))}</span><span class="tok-punc">: </span>`;
          row.innerHTML = `${keyHtml}${leafSpan(v)}${last ? "" : `<span class="tok-punc">,</span>`}`;
        }
        body.appendChild(row);
      });
      if (entries.length > cap) {
        const more = document.createElement("div");
        more.className = "j-more";
        more.textContent = `… 还有 ${entries.length - cap} 项未展开（请用复制结果 / 下载查看完整内容）`;
        body.appendChild(more);
      }

      const foot = document.createElement("div");
      foot.className = "j-head j-foot";
      foot.innerHTML = `<span class="tok-punc">${close}</span>${comma}`;

      node.appendChild(head);
      node.appendChild(body);
      node.appendChild(foot);
      return node;
    }
    const div = document.createElement("div");
    div.className = "j-line";
    div.innerHTML = `${leafSpan(value)}${comma}`;
    return div;
  }

  function setAllFolded(collapsed) {
    output.querySelectorAll(".j-node").forEach((node) => {
      const head = node.querySelector(":scope > .j-head");
      const body = node.querySelector(":scope > .j-body");
      const foot = node.querySelector(":scope > .j-foot");
      if (!head || !body || !foot) return;
      node.classList.toggle("collapsed", collapsed);
      head.querySelector(".j-toggle").textContent = collapsed ? "▸" : "▾";
      head.querySelector(".j-preview").hidden = !collapsed;
      body.hidden = collapsed;
      foot.hidden = collapsed;
    });
  }

  function renderTree(docs) {
    treeEl.innerHTML = "";
    let text = "";
    try { text = JSON.stringify(docs.length === 1 ? docs[0] : docs); } catch (_) { text = ""; }
    if (text && text.length > 500000) {
      treeEl.textContent = "对象过大，已跳过树形渲染（请用文本模式查看）。";
      return;
    }
    docs.forEach((v, i) => {
      if (docs.length > 1) treeEl.appendChild(docLabel(i, docs.length, v));
      treeEl.appendChild(buildTreeNode(v, 0));
    });
  }

  function buildTreeNode(value, depth) {
    const wrap = document.createElement("div");
    if (value !== null && typeof value === "object") {
      const isArr = Array.isArray(value);
      const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
      const det = document.createElement("details");
      if (depth < 2) det.open = true;
      const sum = document.createElement("summary");
      sum.textContent = isArr ? `Array(${entries.length})` : `Object{${entries.length}}`;
      det.appendChild(sum);
      const cap = 500;
      entries.slice(0, cap).forEach(([k, v]) => {
        const row = document.createElement("div");
        if (v !== null && typeof v === "object") {
          const label = document.createElement("span");
          label.innerHTML = `<span class="k">${esc(String(k))}</span>: `;
          row.appendChild(label);
          row.appendChild(buildTreeNode(v, depth + 1));
        } else {
          row.innerHTML = `<span class="k">${esc(String(k))}</span>: ${leafHtml(v)}`;
        }
        det.appendChild(row);
      });
      if (entries.length > cap) {
        const more = document.createElement("div");
        more.style.color = "var(--muted)";
        more.textContent = `… 还有 ${entries.length - cap} 项未展开（用文本模式查看完整内容）`;
        det.appendChild(more);
      }
      wrap.appendChild(det);
    } else {
      wrap.innerHTML = leafHtml(value);
    }
    return wrap;
  }

  function leafHtml(v) {
    if (v === null) return `<span class="null">null</span>`;
    const t = typeof v;
    if (t === "string") return `<span class="s">${esc(JSON.stringify(v))}</span>`;
    if (t === "number") return `<span class="n">${esc(String(v))}</span>`;
    if (t === "boolean") return `<span class="b">${esc(String(v))}</span>`;
    return esc(String(v));
  }

  function updateInputCount() { $("st-input").textContent = input.value.length; }

  // ---------- 左侧变化 -> 右侧跟随（防抖，不改左侧，不弹通知） ----------
  let autoTimer = null;
  function resetRightToPlaceholder() {
    output.textContent = "格式化结果将显示在这里…";
    output.classList.add("placeholder"); treeEl.innerHTML = "";
    lastDocs = null; lastText = "";
    $("st-status").textContent = "待处理"; $("st-output").textContent = "0";
    $("st-type").textContent = "-"; $("st-depth").textContent = "-"; $("st-keys").textContent = "-";
  }
  function scheduleAutoFormat() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const raw = input.value.trim();
      if (!raw) { resetRightToPlaceholder(); save(); return; }
      if (raw.length > 500000) { $("st-status").textContent = "⚠️ 过大，请手动格式化"; return; }
      try {
        const docs = parseAndExpand();
        render(stringifyDocs(docs, getIndent()), docs, { keepTab: true });
        $("st-status").textContent = okStatus(docs);
        save();
      } catch (e) {
        // 左侧改错时右侧实时显示错误卡片（含位置 + 自动修复按钮）
        renderError(e);
      }
    }, 300);
  }

  // ---------- 动作（只写右侧，不动左侧，不弹通知） ----------
  function doFormat(sorted) {
    try {
      let docs = parseAndExpand();
      if (sorted) docs = docs.map(sortKeysDeep);
      render(stringifyDocs(docs, getIndent()), docs);
      $("st-status").textContent = okStatus(docs);
      save();
    } catch (e) {
      renderError(e);
    }
  }

  function doMinify() {
    try {
      const docs = parseInput();
      render(stringifyDocs(docs, null), docs, { plain: true });
      $("st-status").textContent = okStatus(docs);
      save();
    } catch (e) {
      renderError(e);
    }
  }

  function doValidate() {
    try {
      const docs = parseAndExpand();
      const { maxDepth, keys } = docsStats(docs);
      $("st-status").textContent = okStatus(docs);
      $("st-type").textContent = docsType(docs);
      $("st-depth").textContent = maxDepth;
      $("st-keys").textContent = keys;
      // 验证通过也同步右侧（若右侧为空），方便查看；已有结果则保留
      if (!lastText) render(stringifyDocs(docs, getIndent()), docs);
    } catch (e) {
      renderError(e);
    }
  }

  // 转义 / 去转义：结果输出到右侧，左侧保持不变
  function doEscape() {
    if (!input.value) return;
    const text = JSON.stringify(input.value);
    try {
      render(text, [input.value]);
      $("st-status").textContent = "✅ 有效 JSON";
    } catch (e) {
      renderError(e);
    }
  }

  function doUnescape() {
    const t = input.value.trim();
    if (!t) return;
    try {
      const once = JSON.parse(t);
      const display = typeof once === "string" ? once : JSON.stringify(once);
      // 去转义后若仍是合法 JSON（含多段）则格式化显示（并展开嵌套转义），否则按原串显示
      const docs = tryParseDocs(display);
      if (docs) {
        const expanded = docs.map((d) => expandNestedJson(d));
        render(stringifyDocs(expanded, getIndent()), expanded);
        $("st-status").textContent = okStatus(expanded);
        return;
      }
      lastText = display;
      lastDocs = [once];
      lastPlain = true;
      output.classList.remove("placeholder");
      output.innerHTML = "";
      const pre = document.createElement("pre");
      pre.className = "j-plain";
      pre.textContent = display;
      output.appendChild(pre);
      $("st-output").textContent = display.length;
      $("st-type").textContent = typeOf(once);
      $("st-status").textContent = "✅ 有效 JSON";
    } catch (e) {
      renderError(e);
    }
  }

  // ---------- 搜索（左右独立）：匹配查找 + mark 高亮 + 上下导航 + 计数 ----------
  const MAX_MATCHES = 2000;
  const leftSearch = { open: false, query: "", matches: [], idx: 0, cs: false };
  const rightSearch = { open: false, query: "", matches: [], idx: 0, cs: false };

  // 子串查找（不区分大小写默认），上限保护
  function findMatches(text, q, cs) {
    const res = [];
    if (!q) return res;
    const src = cs ? text : text.toLowerCase();
    const needle = cs ? q : q.toLowerCase();
    const step = Math.max(q.length, 1);
    let pos = 0;
    while (res.length < MAX_MATCHES) {
      const i = src.indexOf(needle, pos);
      if (i < 0) break;
      res.push({ start: i, end: i + q.length });
      pos = i + step;
    }
    return res;
  }

  // 先占位后着色再 interleaved 插回，避免高亮正则破坏 mark 标签；
  // 占位符为单字符（不会被 tokenizer 拆散），若意外不匹配则回退为普通高亮
  function markMatches(text, matches, idx) {
    const PH = "\uF000";
    let src = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      src = src.slice(0, m.start) + PH + src.slice(m.end);
    }
    const parts = highlight(src).split(PH);
    if (parts.length !== matches.length + 1) return highlight(text);
    let out = parts[0];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      out += `<mark class="srch${i === idx ? " current" : ""}">${esc(text.slice(m.start, m.end))}</mark>` + parts[i + 1];
    }
    return out;
  }

  // 计算当前命中应滚动到的 scrollTop（调用方自行赋值）
  function calcMarkScroll(wrap, scope) {
    const el = scope.querySelector("mark.srch.current");
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect(), c = wrap.getBoundingClientRect();
    return wrap.scrollTop + (r.top - c.top) - Math.max(0, (c.height - r.height) / 2);
  }

  function searchCountText(st) {
    if (!st.query) return "";
    if (!st.matches.length) return "无匹配";
    const more = st.matches.length >= MAX_MATCHES ? "+" : "";
    return `${st.idx + 1} / ${st.matches.length}${more}`;
  }

  // ----- 左侧搜索 -----
  function refreshLeftMatches() {
    leftSearch.matches = findMatches(input.value, leftSearch.query, leftSearch.cs);
    if (leftSearch.idx >= leftSearch.matches.length) leftSearch.idx = 0;
    $("search-count-left").textContent = searchCountText(leftSearch);
  }
  function scrollLeftToCurrent() {
    const wrap = hl.parentElement;
    const v = calcMarkScroll(wrap, hl);
    if (v !== null) { input.scrollTop = v; hl.scrollTop = v; }
  }
  function openLeftSearch() {
    leftSearch.open = true;
    $("searchbar-left").hidden = false;
    const si = $("search-input-left");
    si.value = leftSearch.query;
    refreshLeftMatches();
    renderInputHighlight(true);
    si.focus();
    si.select();
  }
  function closeLeftSearch() {
    leftSearch.open = false;
    leftSearch.query = "";
    leftSearch.matches = [];
    leftSearch.idx = 0;
    $("searchbar-left").hidden = true;
    $("search-count-left").textContent = "";
    renderInputHighlight();
    input.focus();
  }
  function stepLeftSearch(dir) {
    if (!leftSearch.matches.length) return;
    leftSearch.idx = (leftSearch.idx + dir + leftSearch.matches.length) % leftSearch.matches.length;
    renderInputHighlight(true);
    $("search-count-left").textContent = searchCountText(leftSearch);
  }

  // ----- 右侧搜索（扁平高亮视图，天然全部展开） -----
  function refreshRightMatches() {
    rightSearch.matches = findMatches(lastText, rightSearch.query, rightSearch.cs);
    if (rightSearch.idx >= rightSearch.matches.length) rightSearch.idx = 0;
    $("search-count-right").textContent = searchCountText(rightSearch);
  }
  function renderSearchRight(scroll) {
    if (!lastText) {
      output.textContent = "格式化结果将显示在这里…";
      output.classList.add("placeholder");
      return;
    }
    showTextTab();
    output.classList.remove("placeholder");
    refreshRightMatches();
    const pre = document.createElement("pre");
    pre.className = "j-plain";
    pre.innerHTML = markMatches(lastText, rightSearch.matches, rightSearch.idx);
    output.innerHTML = "";
    output.appendChild(pre);
    if (scroll && rightSearch.matches.length) {
      const wrap = output.parentElement;
      const v = calcMarkScroll(wrap, output);
      if (v !== null) wrap.scrollTop = v;
    }
  }
  function restoreRightView() {
    if (lastText && lastDocs && lastDocs.length) {
      output.classList.remove("placeholder");
      renderFoldableOutput(lastText, lastDocs, { plain: lastPlain });
    } else if (lastText) {
      const pre = document.createElement("pre");
      pre.className = "j-plain";
      pre.innerHTML = highlight(lastText);
      output.classList.remove("placeholder");
      output.innerHTML = "";
      output.appendChild(pre);
    } else {
      output.textContent = "格式化结果将显示在这里…";
      output.classList.add("placeholder");
    }
  }
  function openRightSearch() {
    rightSearch.open = true;
    $("searchbar-right").hidden = false;
    const si = $("search-input-right");
    si.value = rightSearch.query;
    if (rightSearch.query) renderSearchRight(true);
    si.focus();
    si.select();
  }
  function closeRightSearch() {
    rightSearch.open = false;
    rightSearch.query = "";
    rightSearch.matches = [];
    rightSearch.idx = 0;
    $("searchbar-right").hidden = true;
    $("search-count-right").textContent = "";
    restoreRightView();
  }
  function stepRightSearch(dir) {
    if (!rightSearch.matches.length) return;
    rightSearch.idx = (rightSearch.idx + dir + rightSearch.matches.length) % rightSearch.matches.length;
    renderSearchRight(true);
  }

  function save() { try { localStorage.setItem(LS_KEY, input.value); } catch (_) {} }
  function restore() {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v) { input.value = v; updateInputCount(); }
    } catch (_) {}
  }

  // ---------- 事件绑定 ----------
  $("btn-format").addEventListener("click", () => doFormat(false));
  $("btn-sort").addEventListener("click", () => doFormat(true));
  $("btn-minify").addEventListener("click", doMinify);
  $("btn-validate").addEventListener("click", doValidate);

  $("btn-escape").addEventListener("click", doEscape);
  $("btn-unescape").addEventListener("click", doUnescape);

  $("btn-sample").addEventListener("click", () => {
    input.value = JSON.stringify({
      name: "WebTools", version: 1, ok: true, tags: ["json", "formatter", "static"],
      author: { name: "you", site: "https://pages.github.com" },
      count: 42, price: 9.9, nothing: null
    }, null, 2);
    updateInputCount(); renderInputHighlight(); doFormat(false);
  });

  $("btn-clear").addEventListener("click", () => {
    input.value = ""; output.textContent = "格式化结果将显示在这里…";
    output.classList.add("placeholder"); treeEl.innerHTML = "";
    lastDocs = null; lastText = "";
    $("st-status").textContent = "待处理"; $("st-output").textContent = "0";
    $("st-type").textContent = "-"; $("st-depth").textContent = "-"; $("st-keys").textContent = "-";
    updateInputCount(); renderInputHighlight(); save(); renderCompare();
  });

  $("btn-copy").addEventListener("click", async () => {
    if (!lastText) return;
    try { await navigator.clipboard.writeText(lastText); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = lastText; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  });

  $("btn-download").addEventListener("click", () => {
    if (!lastText) return;
    const blob = new Blob([lastText], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "formatted.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("btn-expand-all").addEventListener("click", () => setAllFolded(false));
  $("btn-collapse-all").addEventListener("click", () => setAllFolded(true));

  // 布局切换 + 报文选择 + 同步滚动
  ["single", "horizontal", "vertical"].forEach((mode) => {
    $("layout-" + mode).addEventListener("click", () => setLayout(mode));
  });
  ["a", "b"].forEach((side) => {
    $("compare-select-" + side).addEventListener("change", () => {
      renderComparePanel(side);
      const scroller = $("compare-scroll-" + side);
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    });
  });
  const scrollA = $("compare-scroll-a");
  const scrollB = $("compare-scroll-b");
  scrollA.addEventListener("scroll", () => syncCompareScroll(scrollA, scrollB), { passive: true });
  scrollB.addEventListener("scroll", () => syncCompareScroll(scrollB, scrollA), { passive: true });
  $("sync-scroll").addEventListener("change", (e) => {
    syncEnabled = e.currentTarget.checked;
    try { localStorage.setItem(SYNC_KEY, String(syncEnabled)); } catch (_) {}
    if (syncEnabled) syncCompareScroll(scrollA, scrollB);
  });

  function loadTextToLeft(text) {
    input.value = text;
    updateInputCount(); renderInputHighlight(); save();
    doFormat(false);
  }

  // 左侧复制：静默复制输入原文
  $("btn-copy-input").addEventListener("click", async () => {
    if (!input.value) return;
    try { await navigator.clipboard.writeText(input.value); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = input.value; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  });

  // 拖拽导入
  ["dragover", "drop"].forEach((ev) => {
    input.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "drop" && e.dataTransfer.files.length) {
        const f = e.dataTransfer.files[0];
        const r = new FileReader();
        r.onload = () => { loadTextToLeft(String(r.result || "")); };
        r.readAsText(f);
      }
    });
  });

  // Tab 切换
  $("tab-text").addEventListener("click", () => {
    $("tab-text").classList.add("active"); $("tab-tree").classList.remove("active");
    output.hidden = false; treeEl.hidden = true;
  });
  $("tab-tree").addEventListener("click", () => {
    $("tab-tree").classList.add("active"); $("tab-text").classList.remove("active");
    output.hidden = true; treeEl.hidden = false;
    if (!lastDocs) { try { lastDocs = parseAndExpand(); renderTree(lastDocs); } catch (_) { treeEl.textContent = "输入无效，无法预览树形。"; } }
  });

  // ---------- 搜索事件绑定（左右独立，Enter 下一个 / Shift+Enter 上一个 / Esc 关闭） ----------
  let rightDeb = null;
  [
    { side: "left", S: leftSearch,
      render: (scroll) => { renderInputHighlight(scroll); },
      step: stepLeftSearch, open: openLeftSearch, close: closeLeftSearch },
    { side: "right", S: rightSearch,
      render: (scroll) => {
        if (rightSearch.query) renderSearchRight(scroll);
        else { restoreRightView(); $("search-count-right").textContent = ""; }
      },
      step: stepRightSearch, open: openRightSearch, close: closeRightSearch },
  ].forEach((cfg) => {
    const si = $("search-input-" + cfg.side);
    si.addEventListener("input", () => {
      cfg.S.query = si.value;
      cfg.S.idx = 0;
      if (cfg.side === "right") {
        clearTimeout(rightDeb);
        rightDeb = setTimeout(() => cfg.render(true), 120);
      } else {
        cfg.render(true);
      }
    });
    si.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); cfg.step(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { e.preventDefault(); cfg.close(); }
    });
    $("search-prev-" + cfg.side).addEventListener("click", () => cfg.step(-1));
    $("search-next-" + cfg.side).addEventListener("click", () => cfg.step(1));
    $("search-close-" + cfg.side).addEventListener("click", () => cfg.close());
    $("search-case-" + cfg.side).addEventListener("click", () => {
      cfg.S.cs = !cfg.S.cs;
      $("search-case-" + cfg.side).classList.toggle("on", cfg.S.cs);
      cfg.S.idx = 0;
      cfg.render(true);
    });
  });
  $("btn-search-left").addEventListener("click", () => {
    $("searchbar-left").hidden ? openLeftSearch() : closeLeftSearch();
  });
  $("btn-search-right").addEventListener("click", () => {
    $("searchbar-right").hidden ? openRightSearch() : closeRightSearch();
  });

  // 输入计数 + 快捷键 + 高亮刷新 + 右侧跟随
  let hlTimer = null;
  input.addEventListener("input", () => {
    updateInputCount();
    clearTimeout(hlTimer);
    hlTimer = setTimeout(renderInputHighlight, 60);
    scheduleAutoFormat();
  });
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doFormat(false); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) { e.preventDefault(); openLeftSearch(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const s = input.selectionStart, en = input.selectionEnd;
      input.value = input.value.slice(0, s) + "  " + input.value.slice(en);
      input.selectionStart = input.selectionEnd = s + 2;
      updateInputCount(); renderInputHighlight(); scheduleAutoFormat();
    }
  });

  // 粘贴后只渲染右侧，不改写左侧原文，不弹通知（立即渲染一次，并取消待处理的自动跟随避免重复）
  input.addEventListener("paste", () => {
    setTimeout(() => {
      clearTimeout(autoTimer);
      if (!input.value.trim()) return renderInputHighlight();
      renderInputHighlight();
      try {
        const docs = parseAndExpand();
        render(stringifyDocs(docs, getIndent()), docs);
        $("st-status").textContent = okStatus(docs);
        save();
      } catch (e) {
        renderError(e);
      }
    }, 30);
  });

  // 缩进切换后右侧跟随重渲染（保持当前页签）
  $("sel-indent").addEventListener("change", () => {
    if (!input.value.trim() || !lastText) return;
    try {
      const docs = parseAndExpand();
      render(stringifyDocs(docs, getIndent()), docs, { keepTab: true });
      $("st-status").textContent = okStatus(docs);
    } catch (e) {
      renderError(e);
    }
  });

  // 输入框高亮滚动与滚动条占位同步
  input.addEventListener("scroll", () => { hl.scrollTop = input.scrollTop; });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncHlPadding).observe(input);
  else window.addEventListener("resize", syncHlPadding);

  try {
    syncEnabled = localStorage.getItem(SYNC_KEY) !== "false";
    $("sync-scroll").checked = syncEnabled;
    setLayout(localStorage.getItem(LAYOUT_KEY) || "single", false);
  } catch (_) {
    syncEnabled = true;
    $("sync-scroll").checked = true;
    setLayout("single", false);
  }
  restore();
  updateInputCount();
  renderInputHighlight();
  syncHlPadding();
  // 启动时若左侧有存档内容，右侧直接跟随渲染一次
  if (input.value.trim()) {
    try {
      const docs = parseAndExpand();
      render(stringifyDocs(docs, getIndent()), docs, { keepTab: true });
      $("st-status").textContent = okStatus(docs);
    } catch (_) { /* 存档无效则保持占位，不打扰 */ }
  }
})();
