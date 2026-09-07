/* 时间戳转换：秒/毫秒自适应，时区可选，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const inTs = $("in-ts"), inDate = $("in-date"), inPicker = $("in-picker");
  const outDate = $("out-date"), outTs = $("out-ts"), selTz = $("sel-tz");
  const alertBox = $("alert");

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  const pad = (n, l = 2) => String(n).padStart(l, "0");

  function tz() { return selTz.value; }

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
      const label = zone === "local"
        ? "(本地 UTC" + -d.getTimezoneOffset() / 60 + ")"
        : "(" + zone + ")";
      return s + " " + label;
    } catch (e) { return d.toLocaleString(); }
  }

  // ---- 实时时钟 ----
  function tick() {
    const now = new Date();
    $("now-s").textContent = Math.floor(now.getTime() / 1000);
    $("now-ms").textContent = now.getTime();
    $("now-local").textContent = now.toLocaleString();
    $("now-utc").textContent = now.toUTCString();
  }
  tick(); setInterval(tick, 1000);

  // ---- 时间戳 → 日期 ----
  function tsToDate() {
    clearAlert();
    const raw = inTs.value.trim().replace(/[,_\s]/g, "");
    if (!raw) return showAlert("请先输入时间戳。", false);
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return showAlert("时间戳格式无效，只允许数字（可含小数）。", false);
    let num = parseFloat(raw);
    // 自适应：>=1e14 按微秒，>=1e11 按毫秒，否则按秒
    let ms;
    const abs = Math.abs(num);
    if (abs >= 1e14) ms = num / 1000;
    else if (abs >= 1e11) ms = num;
    else if (abs >= 1e9) ms = num * 1000;
    else ms = num * 1000; // 小数字也按秒
    const d = new Date(ms);
    if (isNaN(d.getTime())) return showAlert("该时间戳超出可表示范围。", false);
    outDate.innerHTML =
      `<div><b>本地/所选时区：</b>${fmtInTz(d, true)}</div>` +
      `<div><b>秒级：</b>${Math.floor(ms / 1000)}　<b>毫秒级：</b>${Math.floor(ms)}</div>` +
      `<div><b>ISO：</b>${d.toISOString()}</div>` +
      `<div><b>UTC：</b>${d.toUTCString()}</div>`;
    showAlert("转换成功。", true);
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
    let src = inDate.value.trim();
    if (!src && inPicker.value) {
      // datetime-local 值为 "YYYY-MM-DDTHH:mm"，按本地解析
      src = inPicker.value.replace("T", " ") + (inPicker.value.length === 16 ? ":00" : "");
      inDate.value = src;
    }
    if (!src) return showAlert("请先输入日期或用选择器选时间。", false);
    const d = parseDateInput(src);
    if (!d) return showAlert(`无法解析日期：“${src}”。\n支持格式：YYYY-MM-DD HH:mm:ss、ISO8601、MM/DD/YYYY HH:mm:ss 等。`, false);
    const ms = d.getTime();
    outTs.innerHTML =
      `<div><b>秒级：</b>${Math.floor(ms / 1000)} <button class="btn small" data-copy="${Math.floor(ms / 1000)}">复制</button></div>` +
      `<div><b>毫秒级：</b>${ms} <button class="btn small" data-copy="${ms}">复制</button></div>` +
      `<div><b>ISO：</b>${d.toISOString()}</div>` +
      `<div><b>所选时区：</b>${fmtInTz(d, true)}</div>`;
    showAlert("转换成功。", true);
  }

  // 结果区复制按钮（事件委托）
  outTs.addEventListener("click", (e) => {
    const v = e.target.getAttribute && e.target.getAttribute("data-copy");
    if (v && navigator.clipboard) navigator.clipboard.writeText(v).then(() => showAlert("已复制 " + v, true));
  });

  $("btn-t2d").addEventListener("click", tsToDate);
  $("btn-d2t").addEventListener("click", dateToTs);
  $("btn-now").addEventListener("click", () => {
    const now = Date.now();
    inTs.value = String(Math.floor(now / 1000));
    inDate.value = fmtInTz(new Date(now), false).replace(/\s*\(.*\)$/, "");
    tsToDate();
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
    inTs.value = "1757200000"; inDate.value = "2026-09-07 12:00:00"; tsToDate(); dateToTs();
  });
  $("btn-clear").addEventListener("click", () => {
    inTs.value = ""; inDate.value = ""; inPicker.value = "";
    outDate.textContent = "转换结果显示在这里…"; outTs.textContent = "转换结果显示在这里…";
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
  selTz.addEventListener("change", () => { if (inTs.value.trim()) tsToDate(); });
})();
