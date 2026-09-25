/* ============================================================
   WebTools 全站顶部导航 — 渲染 + 交互（分类下拉 / ⌘K 快速跳转）
   用法：在页面 body 起始处放 <div id="site-nav"></div>，
        紧跟 <script src="…/site-nav.js?v=xxx"></script>
   主题切换按钮由各页面自己的 JS 绑定（#theme-toggle），本文件不绑定。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 部署根路径（兼容子路径 / file://） ---------- */
  var cur = document.currentScript && document.currentScript.src;
  var ROOT;
  if (cur && /assets\/js\//.test(cur)) {
    ROOT = cur.replace(/assets\/js\/[^\/]*(\?.*)?$/, "");
  } else if (/\/tools\//.test(location.pathname)) {
    ROOT = location.href.replace(/tools\/[^\/]*(\?.*)?$/, "");
  } else {
    ROOT = location.href.replace(/[^\/]*$/, "");
  }

  var S = function (p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  };
  var CARET = S('<polyline points="6 9 12 15 18 9"/>').replace("<svg", '<svg class="caret"');
  var SEARCH = S('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>');

  var ICO = {
    json: S('<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4c0 1.1.9 2 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>'),
    yaml: S('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
    b64: S('<rect x="14" y="14" width="4" height="6" rx="1"/><rect x="10" y="4" width="4" height="6" rx="1"/><rect x="18" y="4" width="4" height="14" rx="1"/><rect x="2" y="4" width="4" height="14" rx="1"/>'),
    time: S('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    url: S('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    re: S('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    jwt: S('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
    diff: S('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>'),
    type: S('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
    pwd: S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    md: S('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    img: S('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    data: S('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>')
  };

  /* ---------- 工具清单（单一数据源：下拉菜单 + ⌘K 面板） ---------- */
  var TOOLS = [
    { f: "json-formatter.html", t: "JSON 格式化", tag: "json", g: "格式化", hue: "ico-blue", i: ICO.json, d: "格式化 / 压缩 / 校验 / 高亮 / 树形预览", k: "json format 格式化" },
    { f: "yaml.html", t: "YAML 工具", tag: "yml", g: "格式化", hue: "ico-blue", i: ICO.yaml, d: "YAML 格式化校验，与 Properties 双向转换", k: "yaml yml properties 配置" },
    { f: "markdown.html", t: "Markdown 预览", tag: "md", g: "格式化", hue: "ico-violet", i: ICO.md, d: "实时渲染、表格代码块全支持，可导出 HTML", k: "markdown md 预览" },
    { f: "text-diff.html", t: "文本对比", tag: "diff", g: "格式化", hue: "ico-violet", i: ICO.diff, d: "行级 diff 高亮、忽略空白 / 大小写", k: "diff compare 对比" },
    { f: "case.html", t: "大小写转换", tag: "case", g: "格式化", hue: "ico-violet", i: ICO.type, d: "camelCase / snake_case 等 12 种命名格式互转", k: "case camel snake kebab pascal constant 大小写 驼峰 命名" },
    { f: "timestamp.html", t: "时间戳转换", tag: "time", g: "格式化", hue: "ico-violet", i: ICO.time, d: "Unix 时间戳 ⇄ 日期，秒 / 毫秒自适应", k: "timestamp unix time 时间" },
    { f: "regex.html", t: "正则测试", tag: "re", g: "格式化", hue: "ico-violet", i: ICO.re, d: "实时匹配高亮、分组明细、替换预览", k: "regex regexp 正则" },
    { f: "base64.html", t: "Base64 编解码", tag: "b64", g: "编解码", hue: "ico-teal", i: ICO.b64, d: "文本 ⇄ Base64（UTF-8）、URL-safe、文件转码", k: "base64 encode decode 编码" },
    { f: "url-codec.html", t: "URL 编解码", tag: "url", g: "编解码", hue: "ico-teal", i: ICO.url, d: "encodeURI / Component 互转，Query 表格化编辑", k: "url encode query 编码" },
    { f: "password.html", t: "密码生成器", tag: "pwd", g: "安全密码", hue: "ico-amber", i: ICO.pwd, d: "加密级随机、强度熵评估与批量生成", k: "password 密码 随机" },
    { f: "jwt.html", t: "JWT 解析", tag: "jwt", g: "安全密码", hue: "ico-amber", i: ICO.jwt, d: "Header / Payload 解码高亮、exp 过期判断", k: "jwt token claims" },
    { f: "image-compress.html", t: "图片压缩", tag: "img", g: "图片 / 文件", hue: "ico-amber", i: ICO.img, d: "canvas 本地压缩、限宽高缩放、质量可调", k: "image 图片 压缩" },
    { f: "testdata.html", t: "测试数据生成", tag: "data", g: "图片 / 文件", hue: "ico-amber", i: ICO.data, d: "UUID / 手机号 / 身份证快捷造数", k: "testdata uuid mock 造数" }
  ];
  var GROUPS = ["编解码", "格式化", "安全密码", "图片 / 文件"];
  var HOME = ROOT + "index.html";
  var href = function (f) { return ROOT + "tools/" + f; };

  function menu(g) {
    var items = TOOLS.filter(function (x) { return x.g === g; });
    return (
      '<div class="nav-dd"><button type="button" aria-haspopup="true">' + g + CARET + '</button><div class="dd-menu">' +
      items.map(function (x) {
        return '<a href="' + href(x.f) + '"><span class="mini ' + x.hue + '">' + x.i + "</span>" + x.t + '<span class="tag">' + x.tag + "</span></a>";
      }).join("") +
      "</div></div>"
    );
  }

  var HTML =
    '<header class="topbar"><div class="topbar-inner">' +
    '<a class="logo" href="' + HOME + '" aria-label="WebTools 首页"><span class="logo-mark" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
    "</span>WebTools</a>" +
    '<nav class="nav-center" aria-label="工具分类">' +
    GROUPS.map(menu).join("") +
    '<div class="qsearch"><svg class="qs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
    '<input class="qsearch-input" id="qs" type="search" placeholder="快速跳转…" autocomplete="off" spellcheck="false" aria-label="快速搜索工具">' +
    '<span class="kbd" aria-hidden="true">⌘K</span>' +
    '<div class="qres" id="qres" role="listbox" aria-label="搜索结果"></div></div>' +
    "</nav>" +
    '<div class="top-actions">' +
    '<button class="icon-btn" id="theme-toggle" type="button" aria-label="切换深浅主题" title="切换深浅主题">' +
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
    "</button>" +
    '<a class="icon-btn" href="https://github.com/weihubeats/WebTools" target="_blank" rel="noopener" aria-label="GitHub 仓库" title="GitHub 仓库">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.26 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>' +
    "</a>" +
    "</div></div></header>";

  var ph = document.getElementById("site-nav");
  if (!ph) return;
  ph.outerHTML = HTML;

  /* ---------- 当前工具高亮 ---------- */
  var base = location.pathname.split("/").pop();
  TOOLS.forEach(function (x) {
    if (x.f === base) {
      var a = document.querySelector('.dd-menu a[href$="' + x.f + '"]');
      if (a) {
        a.classList.add("cur");
        a.parentElement.parentElement.classList.add("here");
      }
    }
  });

  /* ---------- 分类下拉（点击展开，触屏可用） ---------- */
  var dds = [].slice.call(document.querySelectorAll(".nav-dd"));
  dds.forEach(function (dd) {
    dd.querySelector("button").addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = dd.classList.contains("open");
      dds.forEach(function (d) { d.classList.remove("open"); });
      if (!wasOpen) dd.classList.add("open");
    });
  });
  document.addEventListener("click", function () {
    dds.forEach(function (d) { d.classList.remove("open"); });
  });

  /* ---------- ⌘K 快速跳转面板 ---------- */
  var qs = document.getElementById("qs");
  var qres = document.getElementById("qres");
  var results = [];
  var activeIdx = -1;

  function matchAll(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return TOOLS.filter(function (x) {
      return (x.t + " " + x.d + " " + x.k + " " + x.tag).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
  }

  function setActive(i) {
    activeIdx = i;
    [].slice.call(qres.querySelectorAll(".qres-item")).forEach(function (el, j) {
      el.classList.toggle("active", j === i);
    });
  }

  function closeResults() {
    qres.classList.remove("show");
    qres.innerHTML = "";
    results = [];
    activeIdx = -1;
  }

  function renderResults(q) {
    results = matchAll(q);
    activeIdx = results.length ? 0 : -1;
    if (!q.trim()) { closeResults(); return; }
    if (!results.length) {
      qres.innerHTML = '<div class="qres-empty">无匹配工具</div>';
      qres.classList.add("show");
      return;
    }
    qres.innerHTML =
      results.map(function (x, i) {
        return (
          '<button class="qres-item' + (i === 0 ? " active" : "") + '" type="button" role="option" data-href="' + href(x.f) + '">' +
          '<span class="qi-ico">' + x.i + "</span>" +
          "<span>" + x.t + '<span class="qi-sub">' + x.d + "</span></span>" +
          '<span class="qi-go">↵</span></button>'
        );
      }).join("") +
      '<div class="qres-hint"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>esc</kbd> 关闭</span></div>';
    qres.classList.add("show");
    [].slice.call(qres.querySelectorAll(".qres-item")).forEach(function (btn) {
      btn.addEventListener("click", function () { location.href = btn.dataset.href; });
      btn.addEventListener("mouseenter", function () {
        setActive([].slice.call(qres.querySelectorAll(".qres-item")).indexOf(btn));
      });
    });
  }

  qs.addEventListener("input", function () { renderResults(qs.value); });
  qs.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((activeIdx + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((activeIdx - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results.length) {
      e.preventDefault();
      location.href = href(results[Math.max(activeIdx, 0)].f);
    } else if (e.key === "Escape") {
      closeResults();
      qs.blur();
    }
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".qsearch")) closeResults();
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      qs.focus();
      qs.select();
      if (qs.value) renderResults(qs.value);
    }
  });
})();
