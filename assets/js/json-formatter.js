/* JSON 格式化工具：纯原生 JS，无依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const input = $("json-input");
  const hl = $("json-input-hl");
  const output = $("json-output");
  const treeEl = $("json-tree");
  const alertBox = $("alert");
  const LS_KEY = "webtools.json.input.v1";

  let lastValue = null; // 最后一次解析成功的对象
  let lastText = "";    // 最后一次输出文本

  // ---------- 基础函数 ----------
  function getIndent() {
    const v = $("sel-indent").value;
    if (v === "tab") return "\t";
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? " ".repeat(n) : null; // null = 压缩
  }

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 4000);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 尝试从错误信息中提取 position，并换算行列
  function errorWithLocation(e, text) {
    let msg = "JSON 解析失败: " + e.message;
    const m = /position\s+(\d+)/i.exec(e.message);
    if (m) {
      const pos = Math.min(parseInt(m[1], 10), text.length);
      const upto = text.slice(0, pos);
      const line = upto.split("\n").length;
      const col = pos - upto.lastIndexOf("\n");
      const lineText = text.split("\n")[line - 1] || "";
      msg += `\n位置：第 ${line} 行，第 ${col} 列（字符 ${pos}）\n${lineText}\n${" ".repeat(Math.max(0, col - 2))}^`;
    }
    return msg;
  }

  function parseInput() {
    const text = input.value.trim();
    if (!text) throw new Error("输入为空，请粘贴 JSON 后再试。");
    // 容错：JS 对象字面量式的单引号？不做自动修正，保持严格 JSON，仅给出提示
    return JSON.parse(text);
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

  // 语法高亮：先转义再用正则着色
  function highlight(json) {
    return esc(json).replace(
      /(&quot;|")([^"&]*?)(&quot;|")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      function (m, q1, str, q3, colon, bool, nil) {
        if (str !== undefined) {
          return colon
            ? `<span class="tok-key">${q1}${str}${q3}</span>${colon}`
            : `<span class="tok-str">${q1}${str}${q3}</span>`;
        }
        if (bool) return `<span class="tok-bool">${bool}</span>`;
        if (/null/.test(m)) return `<span class="tok-null">null</span>`;
        return `<span class="tok-num">${m}</span>`;
      }
    );
  }
  // 注意：esc 后双引号变成 &quot;，上面的正则按 &quot; 处理。数字/bool/null 不受 esc 影响。

  // 输入框语法高亮：textarea 无法着色，用底层 <pre> 叠加实现
  function renderInputHighlight() {
    hl.innerHTML = input.value ? highlight(input.value) + "\n" : "";
    hl.scrollTop = input.scrollTop;
  }
  // 对齐输入框滚动条占位，保证换行位置与 textarea 一致
  function syncHlPadding() {
    hl.style.paddingRight = (12 + (input.offsetWidth - input.clientWidth)) + "px";
  }

  function render(text, value) {
    lastText = text;
    lastValue = value;
    output.classList.remove("placeholder");
    output.innerHTML = highlight(text);
    renderTree(value);
    $("st-output").textContent = text.length;
    $("st-type").textContent = typeOf(value);
    const { maxDepth, keys } = getDepthAndKeys(value);
    $("st-depth").textContent = maxDepth;
    $("st-keys").textContent = keys;
  }

  function renderTree(value) {
    // 大对象截断保护
    const text = JSON.stringify(value);
    treeEl.innerHTML = "";
    if (text && text.length > 500000) {
      treeEl.textContent = "对象过大，已跳过树形渲染（请用文本模式查看）。";
      return;
    }
    treeEl.appendChild(buildTreeNode(value, 0));
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
      const cap = 500; // 每层最多渲染 500 项
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

  // ---------- 动作 ----------
  function doFormat(sorted) {
    clearAlert();
    try {
      let value = parseInput();
      if (sorted) value = sortKeysDeep(value);
      const indent = getIndent();
      const text = indent === null ? JSON.stringify(value) : JSON.stringify(value, null, indent);
      render(text, value);
      $("st-status").textContent = "✅ 有效 JSON";
      showAlert(sorted ? "已按 key 排序并格式化。" : "格式化成功，JSON 有效。", true);
      save();
    } catch (e) {
      $("st-status").textContent = "❌ 无效";
      showAlert(errorWithLocation(e, input.value), false);
    }
  }

  function doMinify() {
    clearAlert();
    try {
      const value = parseInput();
      render(JSON.stringify(value), value);
      $("st-status").textContent = "✅ 有效 JSON";
      showAlert("已压缩为单行。", true);
      save();
    } catch (e) {
      $("st-status").textContent = "❌ 无效";
      showAlert(errorWithLocation(e, input.value), false);
    }
  }

  function doValidate() {
    clearAlert();
    try {
      const value = parseInput();
      const { maxDepth, keys } = getDepthAndKeys(value);
      $("st-status").textContent = "✅ 有效 JSON";
      $("st-type").textContent = typeOf(value);
      $("st-depth").textContent = maxDepth;
      $("st-keys").textContent = keys;
      showAlert(`JSON 有效 ✔\n类型：${typeOf(value)} · 深度：${maxDepth} · 键数：${keys}`, true);
    } catch (e) {
      $("st-status").textContent = "❌ 无效";
      showAlert(errorWithLocation(e, input.value), false);
    }
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

  $("btn-escape").addEventListener("click", () => {
    if (!input.value) return showAlert("输入为空，无需转义。", false);
    input.value = JSON.stringify(input.value);
    updateInputCount(); save(); renderInputHighlight();
    showAlert("已将输入整体转义为 JSON 字符串。", true);
  });
  $("btn-unescape").addEventListener("click", () => {
    try {
      const t = input.value.trim();
      if (!t) return showAlert("输入为空，无需去转义。", false);
      // 若输入本身是 JSON 字符串字面量，先 parse 一次得到原串
      const once = JSON.parse(t);
      input.value = typeof once === "string" ? once : JSON.stringify(once);
      updateInputCount(); save(); renderInputHighlight();
      showAlert("已去转义。", true);
    } catch (e) { showAlert(errorWithLocation(e, input.value), false); }
  });

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
    lastValue = null; lastText = "";
    $("st-status").textContent = "待处理"; $("st-output").textContent = "0";
    $("st-type").textContent = "-"; $("st-depth").textContent = "-"; $("st-keys").textContent = "-";
    updateInputCount(); renderInputHighlight(); clearAlert(); save();
  });

  $("btn-copy").addEventListener("click", async () => {
    if (!lastText) return showAlert("暂无可复制的结果，请先点「格式化」。", false);
    try { await navigator.clipboard.writeText(lastText); showAlert("已复制到剪贴板。", true); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = lastText; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      showAlert("已复制到剪贴板。", true);
    }
  });

  $("btn-download").addEventListener("click", () => {
    if (!lastText) return showAlert("暂无可下载的结果，请先点「格式化」。", false);
    const blob = new Blob([lastText], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "formatted.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("btn-upload").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { input.value = String(r.result || ""); updateInputCount(); renderInputHighlight(); doFormat(false); };
    r.readAsText(f);
    e.target.value = "";
  });

  $("btn-paste").addEventListener("click", async () => {
    try {
      input.value = await navigator.clipboard.readText();
      updateInputCount(); renderInputHighlight(); doFormat(false);
    } catch (_) { showAlert("无法读取剪贴板，请用 Ctrl/Cmd+V 手动粘贴（浏览器权限限制）。", false); }
  });

  // 拖拽导入
  ["dragover", "drop"].forEach((ev) => {
    input.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "drop" && e.dataTransfer.files.length) {
        const f = e.dataTransfer.files[0];
        const r = new FileReader();
        r.onload = () => { input.value = String(r.result || ""); updateInputCount(); renderInputHighlight(); doFormat(false); };
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
    if (lastValue === null) { try { lastValue = parseInput(); renderTree(lastValue); } catch (_) { treeEl.textContent = "输入无效，无法预览树形。"; } }
  });

  // 输入计数 + 快捷键 + 高亮刷新
  let hlTimer = null;
  input.addEventListener("input", () => {
    updateInputCount();
    clearTimeout(hlTimer);
    hlTimer = setTimeout(renderInputHighlight, 60);
  });
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doFormat(false); }
    // Tab 缩进支持
    if (e.key === "Tab") {
      e.preventDefault();
      const s = input.selectionStart, en = input.selectionEnd;
      input.value = input.value.slice(0, s) + "  " + input.value.slice(en);
      input.selectionStart = input.selectionEnd = s + 2;
      updateInputCount(); renderInputHighlight();
    }
  });

  // 粘贴 JSON 后自动格式化（无效内容则保留原样并提示）
  input.addEventListener("paste", () => {
    setTimeout(() => {
      if (!input.value.trim()) return renderInputHighlight();
      try {
        const value = parseInput();
        const indent = getIndent();
        const text = indent === null ? JSON.stringify(value) : JSON.stringify(value, null, indent);
        input.value = text;
        updateInputCount(); save(); renderInputHighlight();
        render(text, value);
        $("st-status").textContent = "✅ 有效 JSON";
        showAlert("已粘贴并自动格式化。", true);
      } catch (e) {
        renderInputHighlight();
        showAlert(errorWithLocation(e, input.value), false);
      }
    }, 30);
  });

  // 输入框高亮滚动与滚动条占位同步
  input.addEventListener("scroll", () => { hl.scrollTop = input.scrollTop; });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncHlPadding).observe(input);
  else window.addEventListener("resize", syncHlPadding);

  restore();
  updateInputCount();
  renderInputHighlight();
  syncHlPadding();
})();
