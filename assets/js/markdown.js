/* Markdown 预览：手写轻量解析器（常用子集），零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const taMd = $("ta-md"), view = $("md-view"), alertBox = $("alert");
  let lastHtml = "";

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3500);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }

  // 行内解析：先抽出行内代码占位，再处理其他，最后还原
  function inline(s) {
    const codes = [];
    s = esc(s);
    s = s.replace(/`([^`]+?)`/g, (_, c) => {
      codes.push(`<code>${c}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, `<img alt="$1" src="$2"$3 />`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`)
      .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
      .replace(/~~([^~]+?)~~/g, "<del>$1</del>")
      .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
      .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
    return s;
  }

  function isTableSep(line) { return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line); }

  function render(src) {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    let html = "", i = 0, listStack = [];

    function closeLists() {
      while (listStack.length) html += listStack.pop() === "ul" ? "</ul>" : "</ol>";
    }

    while (i < lines.length) {
      const line = lines[i];

      // 代码块
      const fence = line.match(/^\s*```(\w*)\s*$/);
      if (fence) {
        closeLists();
        const lang = fence[1] ? ` class="language-${escAttr(fence[1])}"` : "";
        let code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
        i++; // 跳过结束 ```
        html += `<pre><code${lang}>${esc(code.join("\n"))}</code></pre>`;
        continue;
      }
      // 表格
      if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        closeLists();
        const head = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        i += 2;
        html += "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          html += "<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
          i++;
        }
        html += "</tbody></table>";
        continue;
      }
      // 标题
      let h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { closeLists(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; i++; continue; }
      // 分割线
      if (/^\s*([-*_]\s*){3,}\s*$/.test(line)) { closeLists(); html += "<hr />"; i++; continue; }
      // 引用
      if (/^\s*>/.test(line)) {
        closeLists();
        const qs = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) qs.push(lines[i].replace(/^\s*>\s?/, "")), i++;
        html += `<blockquote>${renderInline(qs.join("<br />"))}</blockquote>`;
        continue;
      }
      // 列表
      let ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
      let ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        const tag = ul ? "ul" : "ol";
        const text = ul ? ul[2] : ol[2];
        if (!listStack.length || listStack[listStack.length - 1] !== tag) { html += `<${tag}>`; listStack.push(tag); }
        // task list
        const task = text.match(/^\[([ xX])\]\s+(.*)$/);
        html += task
          ? `<li><input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""} /> ${inline(task[2])}</li>`
          : `<li>${inline(text)}</li>`;
        i++;
        // 列表结束判断：空行或非列表行
        if (i >= lines.length || !/^(\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) closeLists();
        continue;
      }
      // 空行
      if (!line.trim()) { closeLists(); i++; continue; }
      // 普通段落（合并连续行）
      closeLists();
      const ps = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+|(\s*([-*_]\s*){3,}\s*)$)/.test(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        ps.push(lines[i++]);
      }
      html += `<p>${ps.map(inline).join("<br />")}</p>`;
    }
    closeLists();
    return html;
  }
  function renderInline(s) { return inline(s); }

  const SAMPLE = `# WebTools Markdown 示例

欢迎使用 **Markdown 预览**，支持 *斜体*、~~删除线~~、\`行内代码\`。

## 链接与图片

[GitHub Pages](https://pages.github.com) · ![占位图](https://via.placeholder.com/120)

## 列表

- 无序项 A
- 无序项 B
- [x] 已完成任务
- [ ] 待办任务

1. 有序一
2. 有序二

## 代码块

\`\`\`js
const hello = "world";
console.log(hello);
\`\`\`

## 表格

| 工具 | 状态 | 备注 |
| ---- | ---- | ---- |
| JSON | 已上线 | 格式化 |
| JWT | 已上线 | 仅解码 |

> 引用：所有解析均在本地完成。
`;

  function run() {
    clearAlert();
    const src = taMd.value;
    $("st-count").textContent = src.length + " 字符";
    lastHtml = render(src);
    view.innerHTML = lastHtml || `<p style="color:var(--muted)">预览将显示在这里…</p>`;
    try { localStorage.setItem("webtools.md.v1", src); } catch (_) {}
  }

  let timer = null;
  taMd.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  $("btn-sample").addEventListener("click", () => { taMd.value = SAMPLE; run(); });
  $("btn-clear").addEventListener("click", () => { taMd.value = ""; run(); });
  $("btn-copy-html").addEventListener("click", () => {
    if (!lastHtml) return showAlert("暂无内容可复制。", false);
    navigator.clipboard.writeText(lastHtml).then(
      () => showAlert("已复制渲染后的 HTML。", true),
      () => showAlert("复制失败，请手动选中复制。", false)
    );
  });
  $("btn-download").addEventListener("click", () => {
    if (!lastHtml) return showAlert("暂无内容可下载。", false);
    const doc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>markdown-export</title></head><body>\n${lastHtml}\n</body></html>`;
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "markdown.html"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  try {
    const saved = localStorage.getItem("webtools.md.v1");
    taMd.value = saved !== null ? saved : SAMPLE;
  } catch (_) { taMd.value = SAMPLE; }
  run();
})();
