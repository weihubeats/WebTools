/* 文本对比：行级 LCS diff，大文件降级为首尾对齐，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const taA = $("ta-a"), taB = $("ta-b"), view = $("diff-view");
  const alertBox = $("alert");
  let lastOps = [];

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function norm(line) {
    if ($("chk-ws").checked) line = line.trim();
    if ($("chk-case").checked) line = line.toLowerCase();
    return line;
  }

  // 返回 ops: {t:'eq'|'del'|'add', a?, b?}
  function diffLines(A, B) {
    const n = A.length, m = B.length;
    const NA = A.map(norm), NB = B.map(norm);
    // 大规模降级：剥离公共前后缀，中间整体标为改动，避免 O(n*m) 爆炸
    if (n * m > 4e6) {
      let pre = 0;
      while (pre < n && pre < m && NA[pre] === NB[pre]) pre++;
      let suf = 0;
      while (suf < n - pre && suf < m - pre && NA[n - 1 - suf] === NB[m - 1 - suf]) suf++;
      const ops = [];
      for (let i = 0; i < pre; i++) ops.push({ t: "eq", a: A[i], b: B[i] });
      for (let i = pre; i < n - suf; i++) ops.push({ t: "del", a: A[i] });
      for (let j = pre; j < m - suf; j++) ops.push({ t: "add", b: B[j] });
      for (let i = 0; i < suf; i++) ops.push({ t: "eq", a: A[n - suf + i], b: B[m - suf + i] });
      return { ops, fast: true };
    }
    // 标准 LCS DP（行数中等规模）
    const dp = new Uint32Array((n + 1) * (m + 1));
    const idx = (i, j) => i * (m + 1) + j;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[idx(i, j)] = NA[i] === NB[j]
          ? dp[idx(i + 1, j + 1)] + 1
          : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (NA[i] === NB[j]) { ops.push({ t: "eq", a: A[i], b: B[j] }); i++; j++; }
      else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) { ops.push({ t: "del", a: A[i] }); i++; }
      else { ops.push({ t: "add", b: B[j] }); j++; }
    }
    while (i < n) ops.push({ t: "del", a: A[i++] });
    while (j < m) ops.push({ t: "add", b: B[j++] });
    return { ops, fast: false };
  }

  function run() {
    clearAlert();
    const A = taA.value.split("\n"), B = taB.value.split("\n");
    if (!taA.value && !taB.value) {
      view.textContent = "请在上方输入两份文本…";
      $("st-status").textContent = "待对比";
      $("st-eq").textContent = "-"; $("st-del").textContent = "-"; $("st-add").textContent = "-";
      lastOps = [];
      return;
    }
    const t0 = performance.now();
    const { ops, fast } = diffLines(A, B);
    lastOps = ops;
    let eq = 0, del = 0, add = 0, html = "";
    let la = 0, lb = 0;
    ops.forEach((op) => {
      if (op.t === "eq") { eq++; la++; lb++; html += `<div class="d-eq"><span class="no">${la} / ${lb}</span><span>  ${esc(op.a)}</span></div>`; }
      else if (op.t === "del") { del++; la++; html += `<div class="d-del"><span class="no">${la} -</span><span>- ${esc(op.a)}</span></div>`; }
      else { add++; lb++; html += `<div class="d-add"><span class="no">${lb} +</span><span>+ ${esc(op.b)}</span></div>`; }
    });
    view.innerHTML = html || `<div style="padding:12px;color:var(--muted)">两份文本完全相同 ✔</div>`;
    $("st-eq").textContent = eq; $("st-del").textContent = del; $("st-add").textContent = add;
    $("st-status").textContent = (del === 0 && add === 0)
      ? "✅ 完全相同"
      : `差异 ${del + add} 行（${((performance.now() - t0).toFixed(0))} ms${fast ? "·大文件快速模式" : ""}）`;
    if (fast) showAlert("文本较大，已使用快速对比模式（首尾对齐），中间差异整体标出。", true);
  }

  let timer = null;
  function live() {
    if (!$("chk-live").checked) return;
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  }

  $("btn-diff").addEventListener("click", run);
  ["chk-ws", "chk-case"].forEach((id) => $(id).addEventListener("change", run));
  taA.addEventListener("input", live);
  taB.addEventListener("input", live);
  $("btn-swap").addEventListener("click", () => { const t = taA.value; taA.value = taB.value; taB.value = t; run(); });
  $("btn-clear").addEventListener("click", () => { taA.value = ""; taB.value = ""; run(); });
  $("btn-sample").addEventListener("click", () => {
    taA.value = "WebTools 文本对比\nline2: hello world\nline3: 删除我\nline4: 相同行";
    taB.value = "WebTools 文本对比！\nline2: HELLO world\nline3: 新增我\nline4: 相同行\nline5: 多一行";
    run();
  });
  async function pasteTo(ta) {
    try { ta.value = await navigator.clipboard.readText(); run(); }
    catch (_) { showAlert("无法读取剪贴板，请用 Ctrl/Cmd+V 手动粘贴。", false); }
  }
  $("btn-paste-a").addEventListener("click", () => pasteTo(taA));
  $("btn-paste-b").addEventListener("click", () => pasteTo(taB));
  $("btn-copy").addEventListener("click", () => {
    if (!lastOps.length) return showAlert("暂无对比结果。", false);
    const txt = lastOps.map((op) =>
      op.t === "eq" ? "  " + op.a : op.t === "del" ? "- " + op.a : "+ " + op.b).join("\n");
    navigator.clipboard.writeText(txt).then(
      () => showAlert("已复制 diff 文本。", true),
      () => showAlert("复制失败，请手动选中复制。", false)
    );
  });

  run();
})();
