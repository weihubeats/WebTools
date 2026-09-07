/* Base64 编解码：UTF-8 安全，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const taText = $("ta-text"), taB64 = $("ta-b64");
  const alertBox = $("alert");
  const chkUrlsafe = $("chk-urlsafe"), chkLive = $("chk-live");
  let lastFile = { name: "", mime: "", dataUrl: "", b64: "" };
  let lock = false; // 防止实时转换循环触发

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }

  // UTF-8 安全的 base64 编解码（btoa 只能处理 Latin1，需先转字节）
  function encode(text, urlsafe) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    let b64 = btoa(bin);
    if (urlsafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64;
  }
  function decode(b64) {
    let s = b64.trim().replace(/\s+/g, "")
      .replace(/-/g, "+").replace(/_/g, "/");
    // DataURL 只取逗号后部分
    const comma = s.lastIndexOf(",");
    if (/^data:/i.test(s) && comma > -1) s = s.slice(comma + 1);
    if (!s) return "";
    if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw new Error("包含非 Base64 字符（只允许 A-Z a-z 0-9 + / =，或 URL-safe 的 - _）。");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function updateCount() {
    $("st-text").textContent = taText.value.length;
    $("st-b64").textContent = taB64.value.length;
    const b64len = taB64.value.replace(/\s/g, "").length;
    $("st-size").textContent = b64len ? ("约 " + Math.floor(b64len * 3 / 4 / 1024 * 10) / 10 + " KB") : "-";
  }

  function doEncode() {
    clearAlert();
    try {
      taB64.value = encode(taText.value, chkUrlsafe.checked);
      $("st-status").textContent = "✅ 编码成功";
      updateCount();
    } catch (e) { $("st-status").textContent = "❌ 失败"; showAlert("编码失败：" + e.message, false); }
  }
  function doDecode() {
    clearAlert();
    try {
      taText.value = decode(taB64.value);
      $("st-status").textContent = "✅ 解码成功";
      updateCount();
      showAlert("解码成功。", true);
    } catch (e) { $("st-status").textContent = "❌ 无效 Base64"; showAlert("解码失败：" + e.message, false); }
  }

  $("btn-encode").addEventListener("click", doEncode);
  $("btn-decode").addEventListener("click", doDecode);
  $("btn-sample").addEventListener("click", () => {
    taText.value = "你好 WebTools 👋 Hello Base64!";
    doEncode(); showAlert("已填入示例并编码。", true);
  });
  $("btn-swap").addEventListener("click", () => {
    const t = taText.value; taText.value = taB64.value; taB64.value = t; updateCount();
  });
  $("btn-clear").addEventListener("click", () => {
    taText.value = ""; taB64.value = ""; clearAlert();
    $("st-status").textContent = "待处理"; updateCount();
  });

  // 实时转换（防抖 + 防循环）
  let timer = null;
  function liveFrom(from) {
    if (!chkLive.checked || lock) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      lock = true;
      try { from === "text" ? doEncodeSilent() : doDecodeSilent(); } finally { lock = false; }
    }, 300);
  }
  function doEncodeSilent() {
    try {
      if (!taText.value) { taB64.value = ""; }
      else taB64.value = encode(taText.value, chkUrlsafe.checked);
      $("st-status").textContent = "✅ 编码成功";
    } catch (e) { $("st-status").textContent = "❌ 失败"; }
    updateCount();
  }
  function doDecodeSilent() {
    if (!taB64.value.trim()) { taText.value = ""; updateCount(); return; }
    try { taText.value = decode(taB64.value); $("st-status").textContent = "✅ 解码成功"; }
    catch (e) { $("st-status").textContent = "❌ 无效 Base64"; }
    updateCount();
  }
  taText.addEventListener("input", () => { updateCount(); liveFrom("text"); });
  taB64.addEventListener("input", () => { updateCount(); liveFrom("b64"); });
  chkUrlsafe.addEventListener("change", doEncode);

  function copyText(v, okMsg) {
    if (!v) return showAlert("暂无内容可复制。", false);
    navigator.clipboard.writeText(v).then(
      () => showAlert(okMsg, true),
      () => {
        const ta = document.createElement("textarea");
        ta.value = v; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove(); showAlert(okMsg, true);
      }
    );
  }
  $("btn-copy-text").addEventListener("click", () => copyText(taText.value, "已复制原文。"));
  $("btn-copy-b64").addEventListener("click", () => copyText(taB64.value, "已复制 Base64。"));
  $("btn-download-b64").addEventListener("click", () => {
    if (!taB64.value) return showAlert("暂无 Base64 可下载。", false);
    const blob = new Blob([taB64.value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "base64.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---- 文件转 Base64 ----
  $("btn-file").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    if (e.target.files[0]) readFile(e.target.files[0]);
    e.target.value = "";
  });
  [taText, taB64].forEach((el) => {
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); }
    });
  });

  function readFile(f) {
    if (f.size > 20 * 1024 * 1024) return showAlert("文件超过 20MB，已拒绝（浏览器内存保护）。", false);
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || "");
      const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      lastFile = { name: f.name, mime: f.type || "unknown", dataUrl, b64 };
      $("file-info").textContent = `文件：${f.name}（${f.type || "未知类型"}，${(f.size / 1024).toFixed(1)} KB）`;
      $("file-output").textContent = dataUrl.slice(0, 300) + (dataUrl.length > 300 ? "…" : "");
      const img = $("img-preview");
      if (f.type.startsWith("image/")) { img.src = dataUrl; img.style.display = "block"; }
      else { img.style.display = "none"; img.removeAttribute("src"); }
      $("btn-download-file").disabled = false;
      showAlert("文件已转为 Base64，可点「结果填入 Base64 框」。", true);
    };
    r.onerror = () => showAlert("文件读取失败。", false);
    r.readAsDataURL(f);
  }

  $("btn-file-to-text").addEventListener("click", () => {
    if (!lastFile.b64) return showAlert("请先选择文件。", false);
    taB64.value = lastFile.b64; updateCount();
    $("st-status").textContent = "✅ 文件已载入";
  });
  $("btn-download-file").addEventListener("click", () => {
    if (!lastFile.dataUrl) return;
    const a = document.createElement("a");
    a.href = lastFile.dataUrl;
    a.download = lastFile.name || "decoded-file";
    a.click();
  });

  updateCount();
})();
