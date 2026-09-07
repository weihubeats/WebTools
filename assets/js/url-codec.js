/* URL 编解码 + Query 解析 + URL 拆解，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const taRaw = $("ta-raw"), taEnc = $("ta-enc");
  const selMode = $("sel-mode"), chkLive = $("chk-live");
  const alertBox = $("alert"), kvBody = $("kv-body");
  let lock = false;

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function updateCount() {
    $("st-raw").textContent = taRaw.value.length;
    $("st-enc").textContent = taEnc.value.length;
  }

  function enc(s) { return selMode.value === "uri" ? encodeURI(s) : encodeURIComponent(s); }
  function dec(s) {
    // 兼容“被编码了多次”的情况只解一层；% 不完整时给出明确错误
    if (/%(?![0-9A-Fa-f]{2})/.test(s)) throw new Error("存在不完整的 % 编码（如末尾单个 % 或 % 后不足 2 位十六进制）。");
    return decodeURIComponent(s);
  }

  function doEncode(silent) {
    try {
      taEnc.value = enc(taRaw.value);
      $("st-status").textContent = "✅ 编码成功"; updateCount();
      if (!silent) { clearAlert(); showAlert(`编码成功（${selMode.value === "uri" ? "encodeURI" : "encodeURIComponent"}）。`, true); }
    } catch (e) { $("st-status").textContent = "❌ 失败"; showAlert("编码失败：" + e.message, false); }
  }
  function doDecode(silent) {
    try {
      // 若粘贴的是完整 URL 且只想解 query 部分？默认整体解码；整体失败则尝试逐段解码并提示
      taRaw.value = dec(taEnc.value);
      $("st-status").textContent = "✅ 解码成功"; updateCount();
      if (!silent) { clearAlert(); showAlert("解码成功。", true); }
    } catch (e) { $("st-status").textContent = "❌ 解码失败"; showAlert("解码失败：" + e.message + "\n提示：% 后必须是 2 位十六进制；中文原文请点「编码」。", false); }
  }

  $("btn-encode").addEventListener("click", () => doEncode(false));
  $("btn-decode").addEventListener("click", () => doDecode(false));
  $("btn-swap").addEventListener("click", () => {
    const t = taRaw.value; taRaw.value = taEnc.value; taEnc.value = t; updateCount();
  });
  $("btn-clear").addEventListener("click", () => {
    taRaw.value = ""; taEnc.value = ""; clearAlert();
    $("st-status").textContent = "待处理"; updateCount();
  });
  $("btn-sample").addEventListener("click", () => {
    taRaw.value = "https://example.com/搜索?q=你好 WebTools&lang=zh-CN&empty=#锚点 测试";
    doEncode(false);
  });
  selMode.addEventListener("change", () => doEncode(true));

  let timer = null;
  function live(from) {
    if (!chkLive.checked || lock) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      lock = true;
      try { from === "raw" ? doEncode(true) : doDecode(true); } finally { lock = false; }
    }, 300);
  }
  taRaw.addEventListener("input", () => { updateCount(); live("raw"); });
  taEnc.addEventListener("input", () => { updateCount(); live("enc"); });

  function copyOf(el, msg) {
    if (!el.value) return showAlert("暂无内容可复制。", false);
    navigator.clipboard.writeText(el.value).then(
      () => showAlert(msg, true),
      () => { el.select(); document.execCommand("copy"); showAlert(msg, true); }
    );
  }
  $("btn-copy-raw").addEventListener("click", () => copyOf(taRaw, "已复制原文。"));
  $("btn-copy-enc").addEventListener("click", () => copyOf(taEnc, "已复制编码结果。"));

  // ---------- Query 解析 / 回拼 ----------
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function addRow(k, v) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input class="field k" value="${esc(k || "")}" placeholder="key" /></td>
      <td><input class="field v" value="${esc(v || "")}" placeholder="value" /></td>
      <td><button class="btn small btn-del">删除</button></td>`;
    tr.querySelector(".btn-del").addEventListener("click", () => tr.remove());
    kvBody.appendChild(tr);
  }

  function parseQuery() {
    clearAlert();
    let src = taRaw.value.trim() || taEnc.value.trim();
    if (!src) return showAlert("请先在「原文」输入带 query 的 URL 或查询串。", false);
    // 取 ? 后、# 前
    let q = src;
    const qi = q.indexOf("?");
    if (qi > -1) q = q.slice(qi + 1);
    const hi = q.indexOf("#");
    if (hi > -1) q = q.slice(0, hi);
    kvBody.innerHTML = "";
    if (!q) { showAlert("URL 中没有 query（没有 ?… 部分），已清空表格。", true); return; }
    const params = new URLSearchParams(q);
    let n = 0;
    params.forEach((v, k) => { addRow(k, v); n++; });
    if (!n) addRow("", "");
    showAlert(`已解析 ${n} 个参数，可编辑后点「重新拼回 URL」。`, true);
  }

  function buildUrl() {
    const rows = [...kvBody.querySelectorAll("tr")];
    if (!rows.length) return showAlert("表格为空，请先点「从原文解析」或「+ 添加参数」。", false);
    const sp = new URLSearchParams();
    rows.forEach((tr) => {
      const k = tr.querySelector(".k").value, v = tr.querySelector(".v").value;
      if (k) sp.append(k, v);
    });
    const query = sp.toString();
    let base = taRaw.value.trim();
    if (!base) base = "https://example.com/";
    // 剥掉旧 query 与 hash 暂存
    let hash = "";
    const hi = base.indexOf("#");
    if (hi > -1) { hash = base.slice(hi); base = base.slice(0, hi); }
    const qi = base.indexOf("?");
    if (qi > -1) base = base.slice(0, qi);
    // base 可能只是裸 query（如 a=1&b=2），此时保留为相对形式
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(base) || base.startsWith("/") || base.includes(".")) {
      taRaw.value = base + (query ? "?" + query : "") + hash;
    } else {
      taRaw.value = query; // 输入本身就是 query 串
    }
    doEncode(true);
    showAlert("已按表格重新拼接并编码。", true);
  }

  $("btn-parse").addEventListener("click", parseQuery);
  $("btn-build").addEventListener("click", buildUrl);
  $("btn-add-row").addEventListener("click", () => addRow("", ""));

  // ---------- URL 拆解 ----------
  $("btn-split").addEventListener("click", () => {
    clearAlert();
    const src = taRaw.value.trim();
    if (!src) return showAlert("请先输入 URL。", false);
    let u;
    try { u = new URL(src); }
    catch (_) {
      try { u = new URL(src, "https://example.com"); }
      catch (e) { return showAlert("URL 解析失败：" + e.message + "\n示例：https://example.com:8080/p?a=1#h", false); }
    }
    const rows = [
      ["protocol", u.protocol], ["username", u.username || "-"], ["host", u.host],
      ["hostname", u.hostname], ["port", u.port || "-"], ["pathname", u.pathname],
      ["search", u.search || "-"], ["hash", u.hash || "-"],
      ["origin", u.origin], ["href", u.href],
    ];
    $("url-parts").innerHTML = rows.map(([k, v]) =>
      `<div><b>${esc(k)}：</b><code>${esc(String(v))}</code></div>`).join("") +
      `<div style="margin-top:6px;color:var(--muted)">query 参数 ${u.searchParams.size} 个，可点「从原文解析」进入表格编辑。</div>`;
    if (u.search) parseQuery();
  });

  addRow("q", "你好");
  addRow("lang", "zh-CN");
  updateCount();
})();
