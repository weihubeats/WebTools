/* 图片压缩：canvas 本地缩放 + 质量/格式调节，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const alertBox = $("alert"), dropzone = $("dropzone");
  let srcImg = null, srcInfo = { name: "", type: "", size: 0, w: 0, h: 0 };
  let outBlob = null, outUrl = "";

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 4000);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function kb(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  $("in-q").addEventListener("input", () => { $("q-val").textContent = $("in-q").value + "%"; });

  function loadFile(f) {
    clearAlert();
    if (!f || !f.type.startsWith("image/")) return showAlert("请选择图片文件。", false);
    if (f.size > 30 * 1024 * 1024) return showAlert("图片超过 30MB，已拒绝（内存保护）。", false);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      srcImg = img;
      srcInfo = { name: f.name, type: f.type, size: f.size, w: img.naturalWidth, h: img.naturalHeight };
      $("img-src").src = url;
      $("info-src").textContent = `${img.naturalWidth}×${img.naturalHeight} · ${kb(f.size)}`;
      $("st-src").textContent = `${img.naturalWidth}×${img.naturalHeight} · ${kb(f.size)}`;
      $("btn-compress").disabled = false;
      dropzone.textContent = `已载入：${f.name}（${img.naturalWidth}×${img.naturalHeight}，${kb(f.size)}）`;
      showAlert("图片已载入，调整参数后点「压缩」。", true);
      compress();
    };
    img.onerror = () => showAlert("图片解码失败，可能是格式不受支持或文件损坏。", false);
    img.src = url;
  }

  function targetFormat() {
    const v = $("sel-fmt").value;
    if (v !== "auto") return v;
    return srcInfo.type === "image/png" ? "image/png" : srcInfo.type === "image/webp" ? "image/webp" : "image/jpeg";
  }

  function compress() {
    clearAlert();
    if (!srcImg) return showAlert("请先选择图片。", false);
    const maxW = Math.max(16, Math.min(8000, parseInt($("in-maxw").value, 10) || 1600));
    const maxH = Math.max(16, Math.min(8000, parseInt($("in-maxh").value, 10) || 1600));
    const q = Math.max(10, Math.min(100, parseInt($("in-q").value, 10) || 80)) / 100;
    const scale = Math.min(1, maxW / srcInfo.w, maxH / srcInfo.h);
    const w = Math.max(1, Math.round(srcInfo.w * scale));
    const h = Math.max(1, Math.round(srcInfo.h * scale));
    const fmt = targetFormat();

    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    // JPEG 不支持透明，先铺白底避免黑底
    if (fmt === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(srcImg, 0, 0, w, h);

    const done = (blob) => {
      if (!blob) return showAlert("压缩失败：浏览器不支持该输出格式，请换 JPEG/PNG。", false);
      outBlob = blob;
      if (outUrl) URL.revokeObjectURL(outUrl);
      outUrl = URL.createObjectURL(blob);
      $("img-dst").src = outUrl;
      $("info-dst").textContent = `${w}×${h} · ${kb(blob.size)} · ${fmt.split("/")[1].toUpperCase()}`;
      $("st-dst").textContent = kb(blob.size);
      $("st-dim").textContent = `${srcInfo.w}×${srcInfo.h} → ${w}×${h}`;
      const ratio = ((1 - blob.size / srcInfo.size) * 100).toFixed(1);
      $("st-ratio").textContent = (blob.size <= srcInfo.size ? "减小 " : "增大 ") + Math.abs(ratio) + "%";
      $("btn-download").disabled = false;
    };
    if (cv.toBlob) {
      try { cv.toBlob(done, fmt, fmt === "image/png" ? undefined : q); }
      catch (e) { showAlert("压缩失败：" + e.message, false); }
    } else { // 极老浏览器兜底
      const dataUrl = cv.toDataURL(fmt, q);
      fetch(dataUrl).then((r) => r.blob()).then(done);
    }
  }

  // 参数变化自动重压（防抖）
  let timer = null;
  ["in-maxw", "in-maxh", "sel-fmt"].forEach((id) => $(id).addEventListener("change", () => {
    if (srcImg) { clearTimeout(timer); timer = setTimeout(compress, 300); }
  }));
  $("in-q").addEventListener("change", () => {
    if (srcImg) { clearTimeout(timer); timer = setTimeout(compress, 300); }
  });

  $("btn-file").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
    e.target.value = "";
  });
  $("btn-compress").addEventListener("click", compress);
  ["dragover", "dragenter"].forEach((ev) => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); dropzone.classList.add("over");
  }));
  ["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); dropzone.classList.remove("over");
  }));
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  $("btn-download").addEventListener("click", () => {
    if (!outBlob) return showAlert("暂无压缩结果。", false);
    const fmt = targetFormat();
    const ext = fmt === "image/png" ? "png" : fmt === "image/webp" ? "webp" : "jpg";
    const base = (srcInfo.name || "image").replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = `${base}-compressed.${ext}`;
    a.click();
    showAlert("已开始下载压缩后的图片。", true);
  });
})();
