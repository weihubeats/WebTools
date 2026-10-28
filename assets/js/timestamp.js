/* 时间戳转换：秒/毫秒自适应，时区可选，结果一键复制，未来/过去推算，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const inTs = $("in-ts"), inDate = $("in-date"), inPicker = $("in-picker");
  const outDate = $("out-date"), outTs = $("out-ts"), selTz = $("sel-tz");
  const alertBox = $("alert");

  const COPY_ICON =
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK_ICON =
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // ---- 提示条：错误用输入附近的内联提示，成功/复制用右下角浮层 ----
  let alertTimer = null;
  function showAlert(msg, ok) {
    clearTimeout(alertTimer);
    if (!ok) {
      alertBox.textContent = msg;
      alertBox.className = "alert error is-inline";
      return;
    }
    clearAlert();
    toast(msg);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }

  // 右下角浮层提示（不打断视线、不挤占布局）
  let toastEl = null, toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ts-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.className = "ts-toast" + (kind === "error" ? " error" : "");
    toastEl.innerHTML = (kind === "error" ? "" : CHECK_ICON) + `<span>${escapeHtml(msg)}</span>`;
    // 强制重排以重启动画
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1900);
  }

  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const tz = () => selTz.value;
  const tzLabel = () => (tz() === "local" ? "本地时区" : tz());

  function fmtInTz(d, withMs) {
    const zone = tz();
    try {
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone: zone === "local" ? undefined : zone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {});
      let s = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
      if (withMs) s += "." + pad(d.getMilliseconds(), 3);
      return s;
    } catch (e) { return d.toLocaleString(); }
  }
  function tzSuffix() {
    const zone = tz();
    return zone === "local" ? "本地 UTC" + -new Date().getTimezoneOffset() / 60 : zone;
  }

  // ---- 复制 ----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }
  /* ---------- 复制按钮状态 ----------
     约定：按钮内只放 <span class="ts-copy-label">文案</span>，复制的值放在 data-copy / data-ms 上，
     这样任何 completeXxx() 只改文案，不会把按钮上的值弄丢（之前用未加引号的数值导致秒/毫秒复制按钮失效） */
  const COPY_LABEL = COPY_ICON + '<span class="ts-copy-label">复制</span>';
  const copyTimers = new WeakMap();

  function baseLabel(btn) {
    const el = btn.querySelector(".ts-copy-label");
    return el ? el.textContent : "复制";
  }
  function paintCopied(btn) {
    const target = btn.closest("[data-copied-holder]") || btn;
    clearTimeout(copyTimers.get(target));
    target.classList.add("ok");
    const state = btn.querySelector(".ts-copy-state");
    const labelEl = btn.querySelector(".ts-copy-label");
    if (state && labelEl) {
      // 秒 / 毫秒这类带单位文字的按钮：保留单位，只换前面的图标
      state.innerHTML = CHECK_ICON;
      btn.setAttribute("aria-label", "已复制" + labelEl.textContent + "级时间戳");
    } else {
      btn.innerHTML = CHECK_ICON + `<span class="ts-copy-label">已复制</span>`;
    }
    copyTimers.set(target, setTimeout(() => {
      target.classList.remove("ok");
      if (!btn.isConnected) return;
      if (state && labelEl) {
        state.innerHTML = COPY_ICON;
        btn.setAttribute("aria-label", "复制" + labelEl.textContent + "级时间戳");
      } else {
        btn.innerHTML = COPY_ICON + `<span class="ts-copy-label">${baseLabel(btn)}</span>`;
      }
    }, 1400));
  }

  function doCopy(text, btn) {
    // 文案必须在绘制「已复制」之前取，否则标签已被替换成「已复制」
    const unit = btn && btn.classList.contains("ts-copy-unit")
      ? (btn.querySelector(".ts-copy-label") || {}).textContent || ""
      : "";
    return copyText(text).then(() => {
      if (btn) paintCopied(btn);
      toast("已复制" + (unit ? " " + unit + "级 " : " ") + text);
    }).catch(() => toast("复制失败，请手动选中文本复制", "error"));
  }

  /* ---------- 结果行渲染 ----------
     行结构：标签 + 等宽数值 + 复制按钮，输入即消失、转换即出现 */
  function renderEmpty(box, text) {
    box.className = "ts-results is-empty";
    box.textContent = text || "转换后结果显示在这里";
  }
  function renderRows(box, rows) {
    box.className = "ts-results";
    box.innerHTML = rows.map((r) =>
      `<div class="ts-row${r.hl ? " hl" : ""}">` +
        `<span class="lbl">${r.label}</span>` +
        `<span class="val">${r.html || escapeHtml(r.value)}</span>` +
        `<button type="button" class="ts-copy" data-copy="${escapeAttr(r.copy || r.value)}" aria-label="复制${r.label}">${COPY_ICON}<span class="ts-copy-label">复制</span></button>` +
      `</div>`
    ).join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // 结果区复制（事件委托，两个结果区共用）
  function bindCopyDelegation(box) {
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".ts-copy");
      if (!btn) return;
      doCopy(btn.getAttribute("data-copy"), btn);
    });
  }
  bindCopyDelegation(outDate);
  bindCopyDelegation(outTs);

  // ---- 实时时钟（可点击复制） ----
  let nowValues = { "now-s": "", "now-ms": "", "now-local": "", "now-utc": "" };
  function tick() {
    const now = new Date();
    nowValues["now-s"] = String(Math.floor(now.getTime() / 1000));
    nowValues["now-ms"] = String(now.getTime());
    nowValues["now-local"] = now.toLocaleString();
    nowValues["now-utc"] = now.toUTCString();
    Object.keys(nowValues).forEach((k) => { $(k).textContent = nowValues[k]; });
  }
  tick(); setInterval(tick, 1000);

  $("now-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".ts-copy");
    if (!btn) return;
    const key = btn.getAttribute("data-copy-src");
    const v = nowValues[key];
    if (v) doCopy(v, btn);
  });

  // ---- 未来 / 过去时间戳 ----
  const offsetList = $("offset-list");
  const UNIT_MS = { sec: 1000, min: 60000, hour: 3600000, day: 86400000 };
  const UNIT_LABEL = { sec: "秒", min: "分钟", hour: "小时", day: "天" };
  const offsets = []; // {ms: number}

  function fmtOffsetLabel(ms) {
    const sign = ms >= 0 ? "+" : "-";
    const a = Math.abs(ms);
    const day = 86400000, hour = 3600000, min = 60000;
    if (a % day === 0) return sign + a / day + " 天";
    if (a % hour === 0) return sign + a / hour + " 小时";
    if (a % min === 0) return sign + a / min + " 分钟";
    return sign + a / 1000 + " 秒";
  }

  function makeOffsetCopyBtn(val, label) {
    // 单位文字常驻（不会被「已复制」顶掉），状态只体现在左侧小图标和后面的 ↺
    return (
      `<button type="button" class="ts-copy ts-copy-unit" data-copy="${val}" title="复制${label}级时间戳 ${val}" aria-label="复制${label}级时间戳">` +
        `<span class="ts-copy-state">${COPY_ICON}</span>` +
        `<span class="ts-copy-label">${label}</span>` +
      `</button>`
    );
  }

  // 只刷新每行显示的数值与时间，不重建 DOM（避免正在点击的按钮被替换掉）
  function refreshOffsetValues() {
    const base = Date.now();
    offsetList.querySelectorAll(".ts-offset-row").forEach((row) => {
      const o = offsets.find((x) => String(x.ms) === row.getAttribute("data-offset-ms"));
      if (!o) return;
      const d = new Date(base + o.ms);
      const s = Math.floor(d.getTime() / 1000);
      row.querySelector(".num").textContent = s;
      row.querySelector(".date").textContent = fmtInTz(d, false);
      const [secBtn, msBtn] = row.querySelectorAll(".ts-copy");
      if (secBtn) secBtn.setAttribute("data-copy", s);
      if (msBtn) msBtn.setAttribute("data-copy", String(d.getTime()));
    });
  }

  function renderOffsets() {
    if (!offsets.length) {
      offsetList.innerHTML = '<div class="ts-offset-empty">点击上方预设，或输入自定义时长，即可得到秒级 / 毫秒级时间戳和对应时间。</div>';
      return;
    }
    const base = Date.now();
    offsetList.innerHTML = offsets.map((o, i) => {
      const d = new Date(base + o.ms);
      const s = Math.floor(d.getTime() / 1000);
      return (
        `<div class="ts-offset-row" data-offset-ms="${o.ms}">` +
          `<span class="lbl">${escapeHtml(fmtOffsetLabel(o.ms))}</span>` +
          `<span class="num">${s}</span>` +
          `<span class="date">${escapeHtml(fmtInTz(d, false))}</span>` +
          `<span class="ts-offset-actions">` +
            makeOffsetCopyBtn(s, "秒") +
            makeOffsetCopyBtn(d.getTime(), "毫秒") +
            `<button type="button" class="ts-del" data-offset-del="${i}" title="移除该条" aria-label="移除${escapeAttr(fmtOffsetLabel(o.ms))}">✕</button>` +
          `</span>` +
        `</div>`
      );
    }).join("");
  }
  function addOffset(ms) {
    if (!isFinite(ms) || ms === 0) { showAlert("请输入大于 0 的时长。", false); return; }
    // 去重，最多保留 10 条
    const idx = offsets.findIndex((o) => o.ms === ms);
    if (idx >= 0) offsets.splice(idx, 1);
    offsets.unshift({ ms });
    if (offsets.length > 10) offsets.length = 10;
    renderOffsets();
  }

  $("offset-quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-offset-min]");
    if (b) addOffset(Number(b.getAttribute("data-offset-min")) * 60000);
  });
  $("btn-offset-add").addEventListener("click", () => {
    const n = parseFloat($("offset-num").value);
    const unit = $("offset-unit").value;
    if (!isFinite(n) || n <= 0) { showAlert("请输入大于 0 的时长。", false); return; }
    addOffset(n * UNIT_MS[unit]);
  });
  $("btn-offset-reset").addEventListener("click", () => {
    offsets.length = 0;
    renderOffsets();
    $("offset-num").value = "30";
    $("offset-unit").value = "min";
    clearAlert();
  });
  $("offset-num").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btn-offset-add").click(); });
  offsetList.addEventListener("click", (e) => {
    const del = e.target.closest("[data-offset-del]");
    if (del) { offsets.splice(Number(del.getAttribute("data-offset-del")), 1); renderOffsets(); return; }
    const btn = e.target.closest(".ts-copy");
    if (btn) doCopy(btn.getAttribute("data-copy"), btn);
  });
  // 时间流逝后只刷新数值，不重建按钮
  setInterval(refreshOffsetValues, 30000);
  renderOffsets();

  // ---- 时间戳 → 日期 ----
  function unitOf(num) {
    const abs = Math.abs(num);
    if (abs >= 1e14) return "micro";
    if (abs >= 1e11) return "ms";
    return "s";
  }
  function tsToDate() {
    clearAlert();
    const raw = inTs.value.trim().replace(/[,_\s]/g, "");
    inTs.classList.remove("is-invalid");
    if (!raw) {
      renderEmpty(outDate, "先输入时间戳，再点「转换」");
      showAlert("请先输入时间戳。", false);
      inTs.classList.add("is-invalid");
      inTs.focus();
      return;
    }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      renderEmpty(outDate, "时间戳格式无效");
      showAlert("时间戳格式无效，只允许数字（可含小数）。", false);
      inTs.classList.add("is-invalid");
      return;
    }
    let num = parseFloat(raw);
    // 自适应：>=1e14 按微秒，>=1e11 按毫秒，否则按秒
    let ms;
    const unit = unitOf(num);
    if (unit === "micro") ms = num / 1000;
    else if (unit === "ms") ms = num;
    else ms = num * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) {
      renderEmpty(outDate, "该时间戳超出可表示范围");
      showAlert("该时间戳超出可表示范围。", false);
      inTs.classList.add("is-invalid");
      return;
    }
    const unitText = unit === "micro" ? "微秒 → 自动换算" : unit === "ms" ? "毫秒（13 位）" : "秒（10 位）";
    renderRows(outDate, [
      { label: "识别为", value: unitText },
      { label: tzLabel(), value: fmtInTz(d, true) + " (" + tzSuffix() + ")", hl: true },
      { label: "秒级", value: String(Math.floor(ms / 1000)) },
      { label: "毫秒级", value: String(Math.floor(ms)) },
      { label: "ISO 8601", value: d.toISOString() },
      { label: "UTC", value: d.toUTCString() },
      { label: "相对现在", value: describeRelative(d.getTime()) },
    ]);
    flash($("pane-t2d"));
    showAlert("转换成功：秒级 " + Math.floor(ms / 1000), true);
  }

  function describeRelative(targetMs) {
    const diff = targetMs - Date.now();
    const a = Math.abs(diff);
    if (a < 1000) return "就是现在";
    let v;
    if (a < 60000) v = Math.round(a / 1000) + " 秒";
    else if (a < 3600000) v = Math.round(a / 60000) + " 分钟";
    else if (a < 86400000) v = Math.round(a / 3600000) + " 小时";
    else if (a < 2592000000) v = Math.round(a / 86400000) + " 天";
    else if (a < 31536000000) v = Math.round(a / 2592000000) + " 个月";
    else v = (a / 31536000000).toFixed(1) + " 年";
    return diff > 0 ? v + "后" : v + "前";
  }

  function flash(el) {
    el.classList.remove("ts-pane-flash");
    void el.offsetWidth;
    el.classList.add("ts-pane-flash");
    setTimeout(() => el.classList.remove("ts-pane-flash"), 500);
  }

  // ---- 日期 → 时间戳 ----
  function parseDateInput(s) {
    s = s.trim();
    if (!s) return null;
    // "YYYY-MM-DD HH:mm:ss" → 转成 ISO 以避免浏览器差异（按本地时区解析）
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s);
    if (m) {
      const [, Y, Mo, D, h, mi, sec = "0", ms = "0"] = m;
      return new Date(+Y, +Mo - 1, +D, +h, +mi, +sec, +ms.padEnd(3, "0").slice(0, 3));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateToTs() {
    clearAlert();
    inDate.classList.remove("is-invalid");
    let src = inDate.value.trim();
    if (!src && inPicker.value) {
      // datetime-local 值为 "YYYY-MM-DDTHH:mm"，按本地解析
      src = inPicker.value.replace("T", " ") + (inPicker.value.length === 16 ? ":00" : "");
      inDate.value = src;
    }
    if (!src) {
      renderEmpty(outTs, "先输入日期或用选择器选时间，再点「转换」");
      showAlert("请先输入日期或用选择器选时间。", false);
      inDate.classList.add("is-invalid");
      inDate.focus();
      return;
    }
    const d = parseDateInput(src);
    if (!d) {
      renderEmpty(outTs, "日期解析失败");
      showAlert(`无法解析日期：“${src}”。支持 YYYY-MM-DD HH:mm:ss、ISO8601、MM/DD/YYYY HH:mm:ss 等格式。`, false);
      inDate.classList.add("is-invalid");
      return;
    }
    const ms = d.getTime();
    const s = Math.floor(ms / 1000);
    renderRows(outTs, [
      { label: "秒级", value: String(s), hl: true },
      { label: "毫秒级", value: String(ms) },
      { label: "ISO 8601", value: d.toISOString() },
      { label: tzLabel(), value: fmtInTz(d, true) },
      { label: "相对现在", value: describeRelative(ms) },
    ]);
    flash($("pane-d2t"));
    showAlert("转换成功：秒级 " + s, true);
  }

  // ---- 事件绑定 ----
  $("btn-t2d").addEventListener("click", tsToDate);
  $("btn-d2t").addEventListener("click", dateToTs);
  $("btn-now").addEventListener("click", () => {
    const now = Date.now();
    inTs.value = String(Math.floor(now / 1000));
    inDate.value = fmtInTz(new Date(now), false);
    if (!inPicker.value) {
      const d = new Date(now);
      inPicker.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    tsToDate();
    dateToTs();
  });
  document.querySelectorAll("[data-ts]").forEach((b) => b.addEventListener("click", () => {
    const k = b.getAttribute("data-ts");
    const now = new Date();
    if (k === "now-s") inTs.value = String(Math.floor(now.getTime() / 1000));
    else if (k === "now-ms") inTs.value = String(now.getTime());
    else { const d0 = new Date(now); d0.setHours(0, 0, 0, 0); inTs.value = String(Math.floor(d0.getTime() / 1000)); }
    tsToDate();
  }));
  $("btn-sample").addEventListener("click", () => {
    inTs.value = "1757200000"; inDate.value = "2026-09-07 12:00:00"; inPicker.value = "";
    tsToDate(); dateToTs();
  });
  $("btn-clear").addEventListener("click", () => {
    inTs.value = ""; inDate.value = ""; inPicker.value = "";
    inTs.classList.remove("is-invalid"); inDate.classList.remove("is-invalid");
    renderEmpty(outDate); renderEmpty(outTs);
    clearAlert();
  });
  inTs.addEventListener("keydown", (e) => { if (e.key === "Enter") tsToDate(); });
  inDate.addEventListener("keydown", (e) => { if (e.key === "Enter") dateToTs(); });
  inPicker.addEventListener("change", () => {
    if (inPicker.value) {
      inDate.value = inPicker.value.replace("T", " ") + (inPicker.value.length === 16 ? ":00" : "");
      dateToTs();
    }
  });
  selTz.addEventListener("change", () => {
    if (inTs.value.trim()) tsToDate();
    if (inDate.value.trim()) dateToTs();
    if (offsets.length) renderOffsets();
  });
})();