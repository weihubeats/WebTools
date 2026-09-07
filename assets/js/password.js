/* 密码生成器：crypto 加密级随机，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const alertBox = $("alert"), list = $("pwd-list");
  const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const LOWER = "abcdefghijklmnopqrstuvwxyz";
  const DIGIT = "0123456789";
  const SYMBOL = "!@#$%^&*()-_=+[]{};:,.<>?/~";
  const AMBIG = "0O1lI";

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }

  // 无偏随机索引（拒绝采样，避免 modulo bias）
  function randInt(max) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let x;
    do { crypto.getRandomValues(arr); x = arr[0]; } while (x >= limit);
    return x % max;
  }
  function pick(pool) { return pool[randInt(pool.length)]; }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function strength(bits) {
    if (bits >= 80) return ["高", "#1a7f37"];
    if (bits >= 60) return ["中高", "#8250df"];
    if (bits >= 40) return ["中等", "#9a6700"];
    return ["弱", "#cf222e"];
  }

  let lastAll = [];
  function gen() {
    clearAlert();
    const len = Math.max(4, Math.min(128, parseInt($("in-len").value, 10) || 16));
    const count = Math.max(1, Math.min(50, parseInt($("in-count").value, 10) || 5));
    const custom = $("in-custom").value;
    let pools = [];
    if (custom) {
      pools = [[...new Set(custom.split(""))].join("")];
    } else {
      if ($("c-upper").checked) pools.push(UPPER);
      if ($("c-lower").checked) pools.push(LOWER);
      if ($("c-digit").checked) pools.push(DIGIT);
      if ($("c-symbol").checked) pools.push(SYMBOL);
      if (!pools.length) return showAlert("请至少勾选一类字符，或填写自定义符号集。", false);
      if ($("c-noamb").checked) {
        pools = pools.map((p) => p.split("").filter((c) => !AMBIG.includes(c)).join("")).filter(Boolean);
        if (!pools.length) return showAlert("排除易混淆后字符集为空，请调整选项。", false);
      }
    }
    const all = pools.join("");
    const needEach = $("c-each").checked && !custom && pools.length > 1 && len >= pools.length;
    lastAll = [];
    list.innerHTML = "";
    const bits = len * Math.log2(all.length);
    const [label, color] = strength(bits);
    for (let n = 0; n < count; n++) {
      let chars = [];
      if (needEach) pools.forEach((p) => chars.push(pick(p)));
      while (chars.length < len) chars.push(pick(all));
      chars = shuffle(chars);
      const pwd = chars.join("");
      lastAll.push(pwd);
      const row = document.createElement("div");
      row.className = "pwd-row";
      row.innerHTML = `<code>${pwd.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>
        <span class="pwd-bits" style="color:${color}">${bits.toFixed(0)} bit · ${label}</span>`;
      row.title = "点击复制";
      row.addEventListener("click", () => {
        navigator.clipboard.writeText(pwd).then(
          () => showAlert("已复制该条密码。", true),
          () => showAlert("复制失败，请手动选中复制。", false)
        );
      });
      list.appendChild(row);
    }
    showAlert(`已生成 ${count} 条（字符集 ${all.length} 个，约 ${bits.toFixed(0)} bit，强度${label}）。`, true);
  }

  $("btn-gen").addEventListener("click", gen);
  $("btn-clear").addEventListener("click", () => {
    list.innerHTML = `<div style="color:var(--muted)">点「生成」开始…</div>`;
    lastAll = []; clearAlert();
  });
  $("btn-copy-all").addEventListener("click", () => {
    if (!lastAll.length) return showAlert("暂无结果，请先点「生成」。", false);
    navigator.clipboard.writeText(lastAll.join("\n")).then(
      () => showAlert(`已复制全部 ${lastAll.length} 条。`, true),
      () => showAlert("复制失败，请手动选中复制。", false)
    );
  });
  [$("in-len"), $("in-count")].forEach((el) => el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") gen();
  }));

  gen();
})();
