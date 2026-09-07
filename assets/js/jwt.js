/* JWT 解析：仅解码不验签，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const taJwt = $("ta-jwt"), alertBox = $("alert");
  const outH = $("out-header"), outP = $("out-payload"), outS = $("out-sig");
  let cache = { header: "", payload: "" };

  const CLAIM_HELP = {
    iss: "签发者", sub: "主题（用户标识）", aud: "受众", exp: "过期时间（秒）",
    nbf: "生效时间（秒）", iat: "签发时间（秒）", jti: "Token 唯一 ID",
    alg: "签名算法（见 Header）", typ: "类型（见 Header）",
  };

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 4000);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function b64urlDecode(seg) {
    let s = seg.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function highlight(json) {
    return esc(json).replace(
      /"([^"]*)"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(\.\d+)?/g,
      (m, str, colon, bool) => {
        if (str !== undefined) return colon ? `<span class="tok-key">"${str}"</span>${colon}` : `<span class="tok-str">"${str}"</span>`;
        if (bool) return `<span class="tok-bool">${bool}</span>`;
        if (m === "null") return `<span class="tok-null">null</span>`;
        return `<span class="tok-num">${m}</span>`;
      }
    );
  }

  function fmtTs(sec) {
    const d = new Date(sec * 1000);
    return isNaN(d.getTime()) ? "无效时间" : d.toLocaleString() + `（${sec}）`;
  }

  function parse() {
    clearAlert();
    const raw = taJwt.value.trim().replace(/\s+/g, "");
    if (!raw) {
      setEmpty("待输入"); return;
    }
    const parts = raw.split(".");
    if (parts.length !== 3) {
      setEmpty("❌ 格式无效");
      showAlert(`JWT 应为 header.payload.signature 三段式（以 . 分隔），当前为 ${parts.length} 段。`, false);
      return;
    }
    let header, payload;
    try {
      header = JSON.parse(b64urlDecode(parts[0]));
      payload = JSON.parse(b64urlDecode(parts[1]));
    } catch (e) {
      setEmpty("❌ 解码失败");
      showAlert("Base64URL 解码 / JSON 解析失败：" + e.message + "\n请确认复制了完整 Token（无截断、无多余空格）。", false);
      return;
    }

    cache.header = JSON.stringify(header, null, 2);
    cache.payload = JSON.stringify(payload, null, 2);
    outH.classList.remove("placeholder"); outP.classList.remove("placeholder");
    outH.innerHTML = highlight(cache.header);
    outP.innerHTML = highlight(cache.payload);
    outS.classList.remove("placeholder");
    outS.textContent = parts[2]
      ? `（Base64URL，${parts[2].length} 字符）\n${parts[0].length > 0 ? parts[2].slice(0, 120) : ""}${parts[2].length > 120 ? "…" : ""}\n\n⚠ 本工具不校验签名，仅确认其存在。`
      : "（空）\n⚠ signature 为空！若 alg 不是 none 则 Token 不完整。";

    // 状态栏
    const alg = header.alg || "(缺失)";
    $("st-alg").textContent = alg;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number") {
      const left = payload.exp - now;
      if (left <= 0) { $("st-exp").textContent = "已过期"; $("st-status").textContent = "⚠ 已过期"; }
      else {
        const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
        $("st-exp").textContent = `剩余约 ${h}h${m}m`;
        $("st-status").textContent = "✅ 有效（仅看时间）";
      }
    } else { $("st-exp").textContent = "无 exp"; $("st-status").textContent = "✅ 解码成功"; }
    if (alg === "none") {
      $("st-status").textContent = "⚠ alg=none 无签名";
      showAlert("警告：该 Token 使用 alg=none（无签名），任何人都可伪造，服务端必须拒绝。", false);
    } else {
      showAlert("解码成功。请注意：仅解码展示，不代表签名有效。", true);
    }

    // Claims 表
    const tb = $("claim-body");
    tb.innerHTML = "";
    const keys = Object.keys(payload);
    if (!keys.length) tb.innerHTML = `<tr><td colspan="3" style="color:var(--muted)">payload 为空对象</td></tr>`;
    keys.forEach((k) => {
      let v = payload[k], note = CLAIM_HELP[k] || "";
      if ((k === "exp" || k === "iat" || k === "nbf") && typeof v === "number") {
        const d = new Date(v * 1000);
        note += (note ? "；" : "") + (isNaN(d.getTime()) ? "无效时间" : d.toLocaleString());
        if (k === "exp") note += v - now <= 0 ? "（已过期）" : "（未过期）";
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><code>${esc(k)}</code></td><td><code>${esc(typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 200)}</code></td><td style="color:var(--muted)">${esc(note)}</td>`;
      tb.appendChild(tr);
    });
  }

  function setEmpty(status) {
    $("st-status").textContent = status;
    $("st-alg").textContent = "-"; $("st-exp").textContent = "-";
    [outH, outP, outS].forEach((el) => { el.textContent = "—"; el.classList.add("placeholder"); });
    $("claim-body").innerHTML = `<tr><td colspan="3" style="color:var(--muted)">暂无</td></tr>`;
    cache = { header: "", payload: "" };
  }

  let timer = null;
  taJwt.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(parse, 300); });
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
    const k = b.getAttribute("data-copy");
    if (!cache[k]) return showAlert("暂无内容可复制，请先粘贴有效 JWT。", false);
    navigator.clipboard.writeText(cache[k]).then(
      () => showAlert(`已复制 ${k}。`, true),
      () => showAlert("复制失败，请手动选中复制。", false)
    );
  }));
  $("btn-sample").addEventListener("click", () => {
    // jwt.io 官方示例（HS256，仅用于展示解码）
    taJwt.value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjcyMDAwMDAwMDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    parse();
  });
  $("btn-clear").addEventListener("click", () => { taJwt.value = ""; clearAlert(); setEmpty("待输入"); });

  parse();
})();
