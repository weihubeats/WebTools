/* 正则测试：实时匹配高亮 + 分组明细 + 替换预览，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const inPattern = $("in-pattern"), inReplace = $("in-replace"), taSrc = $("ta-src");
  const hlView = $("hl-view"), replView = $("repl-view"), matchBody = $("match-body");
  const alertBox = $("alert");
  const flags = ["g", "i", "m", "s", "u"].map((f) => $("f-" + f));
  let lastReplace = "";

  const PRESETS = [
    ["手机号（国内）", "1[3-9]\\d{9}"],
    ["邮箱", "[\\w.-]+@[\\w-]+(\\.[\\w-]+)+"],
    ["URL", "https?://[\\w.-]+(?:\\.[a-z]{2,})(?:/[^\\s]*)?"],
    ["IPv4", "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b"],
    ["日期 YYYY-MM-DD", "\\d{4}-\\d{2}-\\d{2}"],
    ["中文字符", "[\\u4e00-\\u9fa5]+"],
    ["数字（含小数）", "-?\\d+(?:\\.\\d+)?"],
    ["HTML 标签", "<[^>]+>"],
  ];

  function flagStr() { return flags.filter((c) => c.checked).map((c) => c.id.slice(2)).join(""); }
  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function buildRe() {
    const p = inPattern.value;
    if (!p) return null;
    try {
      const re = new RegExp(p, flagStr());
      clearAlert();
      return re;
    } catch (e) {
      alertBox.textContent = "正则语法错误：" + e.message;
      alertBox.className = "alert error";
      return "error";
    }
  }

  function run() {
    const src = taSrc.value;
    const re = buildRe();
    if (re === "error") { $("st-status").textContent = "❌ 正则无效"; return; }
    if (re === null) {
      hlView.textContent = "请先输入正则表达式…";
      matchBody.innerHTML = `<tr><td colspan="4" style="color:var(--muted)">暂无匹配</td></tr>`;
      replView.textContent = "在上方输入“替换为”并点「应用替换」。";
      $("st-count").textContent = "0"; $("st-time").textContent = "-"; $("st-status").textContent = "待输入";
      return;
    }

    const t0 = performance.now();
    // 高亮：用 exec 逐个找，避免 replace 回调里处理 $ 符号的坑；限制最多 500 个匹配防卡死
    const matches = [];
    const global = re.global;
    const rx = new RegExp(re.source, global ? re.flags : re.flags + "g");
    let m, guard = 0;
    try {
      while ((m = rx.exec(src)) !== null && guard < 500) {
        guard++;
        matches.push({ text: m[0], index: m.index, groups: m.slice(1) });
        if (m[0] === "") rx.lastIndex++; // 空匹配保护，防止死循环
        if (!global) break;
      }
    } catch (e) {
      $("st-status").textContent = "❌ 执行失败";
      showAlert("执行失败：" + e.message, false);
      return;
    }
    const dt = (performance.now() - t0).toFixed(1) + " ms";

    // 高亮渲染
    if (!src) {
      hlView.textContent = "请在左侧输入测试文本…";
    } else if (!matches.length) {
      hlView.innerHTML = esc(src);
    } else {
      let html = "", last = 0;
      matches.forEach((mt, i) => {
        html += esc(src.slice(last, mt.index));
        html += `<mark data-i="${i}" title="匹配 #${i + 1}">${esc(mt.text) || "∅(空匹配)"}</mark>`;
        last = mt.index + mt.text.length;
      });
      html += esc(src.slice(last));
      hlView.innerHTML = html;
    }

    // 明细表
    if (!matches.length) {
      matchBody.innerHTML = `<tr><td colspan="4" style="color:var(--muted)">暂无匹配</td></tr>`;
    } else {
      matchBody.innerHTML = "";
      matches.slice(0, 200).forEach((mt, i) => {
        const tr = document.createElement("tr");
        const g = mt.groups.length
          ? mt.groups.map((g2, gi) => `$${gi + 1}=${g2 === undefined ? "<i>未参与</i>" : `<code>${esc(String(g2))}</code>`}`).join(" ")
          : "<span style='color:var(--muted)'>无</span>";
        tr.innerHTML = `<td>${i + 1}</td><td><code>${esc(mt.text.slice(0, 120)) || "∅"}</code></td><td>${mt.index}</td><td>${g}</td>`;
        matchBody.appendChild(tr);
      });
      if (matches.length > 200) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="4" style="color:var(--muted)">… 还有 ${matches.length - 200} 个，仅展示前 200 个</td>`;
        matchBody.appendChild(tr);
      }
    }

    $("st-count").textContent = matches.length + (guard >= 500 ? "+" : "");
    $("st-time").textContent = dt;
    $("st-status").textContent = matches.length ? "✅ 匹配成功" : "○ 无匹配";

    // 替换预览（实时）
    updateReplacePreview(re);
  }

  function updateReplacePreview(re) {
    re = re || buildRe();
    if (!re || re === "error" || !inReplace.value) return;
    try {
      lastReplace = taSrc.value.replace(re, inReplace.value);
      replView.textContent = lastReplace.slice(0, 5000) + (lastReplace.length > 5000 ? "\n…（过长已截断，复制查看完整）" : "");
    } catch (e) { replView.textContent = "替换失败：" + e.message; }
  }

  // 速查表
  $("btn-cheatsheet").addEventListener("click", () => {
    const box = $("cheatsheet");
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = PRESETS.map(([n, p]) =>
      `<div style="margin-bottom:4px"><b>${esc(n)}</b> <code>${esc(p)}</code> <button class="btn small" data-p="${esc(p)}">填入</button></div>`
    ).join("") + `<div style="color:var(--muted)">备忘：\\d 数字 \\w 单词 \\s 空白 ^ $ 锚点 * + ? 量词 {n,m} ( ) 分组 [ ] 字符集 | 或 (?&lt;name&gt;) 命名组</div>`;
    box.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
      inPattern.value = b.getAttribute("data-p"); run();
    }));
  });

  let timer = null;
  function live() {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }
  [inPattern, inReplace, taSrc].forEach((el) => el.addEventListener("input", live));
  flags.forEach((c) => c.addEventListener("change", run));

  $("btn-replace").addEventListener("click", () => {
    const re = buildRe();
    if (!re || re === "error") return;
    updateReplacePreview(re);
    if (lastReplace) showAlert("已生成替换预览，可点右侧「复制替换结果」。", true);
  });
  $("btn-copy-repl").addEventListener("click", () => {
    if (!lastReplace) return showAlert("暂无替换结果，请先输入“替换为”。", false);
    navigator.clipboard.writeText(lastReplace).then(
      () => showAlert("已复制替换结果。", true),
      () => showAlert("复制失败，请手动选中复制（浏览器权限限制）。", false)
    );
  });
  $("btn-sample").addEventListener("click", () => {
    inPattern.value = "(\\d{4})-(\\d{2})-(\\d{2})";
    $("f-g").checked = true;
    taSrc.value = "今天 2026-09-07，明天 2026-09-08\n订单号 2026-13-99 不是合法日期但也会被匹配";
    inReplace.value = "$1年$2月$3日";
    run();
  });
  $("btn-clear").addEventListener("click", () => {
    inPattern.value = ""; taSrc.value = ""; inReplace.value = ""; lastReplace = ""; run();
  });

  run();
})();
