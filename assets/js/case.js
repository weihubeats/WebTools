/* 大小写 / 命名格式转换 — 12 种格式实时互转（零依赖，全本地） */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };

  var alertBox = $("#alert");
  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(function () {
      if (alertBox.className.indexOf("ok") !== -1) alertBox.className = "alert";
    }, 3500);
  }

  /* ---------- 分词：驼峰边界 + 分隔符 ---------- */
  var MARK = "\u0001";
  function splitWords(line) {
    return line
      .replace(/([a-z0-9])([A-Z])/g, "$1" + MARK + "$2")       // aB / 2B
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1" + MARK + "$2")     // HTTPServer → HTTP | Server
      .split(/[\s_\-./:]+|\u0001/)                               // 分隔符 + 驼峰边界
      .filter(Boolean);
  }
  var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
  var low = function (w) { return w.toLowerCase(); };
  var up = function (w) { return w.toUpperCase(); };

  var FORMATS = [
    { name: "camelCase", desc: "小驼峰（首词小写）", fn: function (ws) { return ws.length ? ws[0].toLowerCase() + ws.slice(1).map(cap).join("") : ""; } },
    { name: "PascalCase", desc: "大驼峰 / 帕斯卡", fn: function (ws) { return ws.map(cap).join(""); } },
    { name: "snake_case", desc: "下划线小写", fn: function (ws) { return ws.map(low).join("_"); } },
    { name: "CONSTANT_CASE", desc: "下划线大写（常量）", fn: function (ws) { return ws.map(up).join("_"); } },
    { name: "kebab-case", desc: "连字符小写（中横线）", fn: function (ws) { return ws.map(low).join("-"); } },
    { name: "Train-Case", desc: "连字符大写（短横线）", fn: function (ws) { return ws.map(cap).join("-"); } },
    { name: "dot.case", desc: "点分小写", fn: function (ws) { return ws.map(low).join("."); } },
    { name: "path/case", desc: "斜杠小写（路径）", fn: function (ws) { return ws.map(low).join("/"); } },
    { name: "Title Case", desc: "标题格式（词首大写）", fn: function (ws) { return ws.map(cap).join(" "); } },
    { name: "Sentence case", desc: "句首大写", fn: function (ws) { return ws.length ? ws[0].charAt(0).toUpperCase() + ws[0].slice(1).toLowerCase() + (ws.length > 1 ? " " + ws.slice(1).map(low).join(" ") : "") : ""; } },
    { name: "lower case", desc: "全小写（空格分隔）", fn: function (ws) { return ws.map(low).join(" "); } },
    { name: "UPPER CASE", desc: "全大写（空格分隔）", fn: function (ws) { return ws.map(up).join(" "); } }
  ];

  /* ---------- DOM：结果行（一次构建，输入时只更新文本） ---------- */
  var ta = $("#ta-in");
  var results = $("#case-results");
  var rows = [];

  FORMATS.forEach(function (fmt, i) {
    var row = document.createElement("div");
    row.className = "case-row";
    row.innerHTML =
      '<div class="case-label"><b></b><em></em></div>' +
      '<div class="case-val"></div>' +
      '<button class="btn small case-copy" type="button">复制</button>';
    row.querySelector("b").textContent = fmt.name;
    row.querySelector("em").textContent = fmt.desc;
    row.querySelector(".case-copy").addEventListener("click", function () {
      var btn = this;
      copyText(rows[i].val.textContent, function (ok) {
        if (ok) {
          btn.textContent = "已复制";
          setTimeout(function () { btn.textContent = "复制"; }, 1200);
        } else showAlert("复制失败，请手动选择复制", false);
      });
    });
    results.appendChild(row);
    rows.push({ fmt: fmt, val: row.querySelector(".case-val") });
  });

  var emptyHint = document.createElement("div");
  emptyHint.className = "case-empty";
  emptyHint.textContent = "在左侧输入，结果实时显示在这里";
  results.appendChild(emptyHint);

  /* ---------- 复制 ---------- */
  function copyText(v, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(function () { cb(true); }, function () { cb(legacy(v)); });
    } else cb(legacy(v));
  }
  function legacy(v) {
    var t = document.createElement("textarea");
    t.value = v;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }

  /* ---------- 转换 ---------- */
  function update() {
    var raw = ta.value;
    var lines = raw.split("\n");
    var hasInput = raw.trim().length > 0;
    emptyHint.style.display = hasInput ? "none" : "";
    results.style.padding = hasInput ? "" : "0";

    rows.forEach(function (r) {
      if (!hasInput) { r.val.textContent = ""; return; }
      r.val.textContent = lines.map(function (l) {
        var ws = splitWords(l);
        return ws.length ? r.fmt.fn(ws) : "";
      }).join("\n");
    });

    var nonEmpty = lines.filter(function (l) { return l.trim(); });
    var wordCount = nonEmpty.reduce(function (a, l) { return a + splitWords(l).length; }, 0);
    $("#st-lines").textContent = nonEmpty.length;
    $("#st-chars").textContent = raw.length;
    $("#st-words").textContent = wordCount;
    $("#st-status").textContent = hasInput ? "已转换 " + nonEmpty.length + " 行" : "待处理";
    $("#case-sub").textContent = FORMATS.length + " 种格式" + (hasInput ? " · " + nonEmpty.length + " 行" : "");
  }

  /* ---------- 事件 ---------- */
  var live = $("#chk-live");
  ta.addEventListener("input", function () { if (live.checked) update(); });
  live.addEventListener("change", function () { if (live.checked) update(); });
  $("#btn-convert").addEventListener("click", function () {
    update();
    showAlert("已转换 " + $("#st-lines").textContent + " 行 × " + FORMATS.length + " 种格式", true);
  });

  $("#btn-sample").addEventListener("click", function () {
    ta.value = [
      "user_name",
      "userName",
      "USER-NAME",
      "http response code",
      "GET /api/UserInfo",
      "orderId2",
      "JSONParserFactory",
      "2026-09-25 创建的订单"
    ].join("\n");
    update();
    ta.focus();
  });

  $("#btn-clear").addEventListener("click", function () {
    ta.value = "";
    update();
    ta.focus();
  });

  $("#btn-copy-in").addEventListener("click", function () {
    var btn = this;
    copyText(ta.value, function (ok) {
      if (ok) { btn.textContent = "已复制"; setTimeout(function () { btn.textContent = "复制"; }, 1200); }
      else showAlert("复制失败，请手动选择复制", false);
    });
  });

  $("#btn-copy-all").addEventListener("click", function () {
    var btn = this;
    if (!ta.value.trim()) { showAlert("请先输入要转换的文本", false); return; }
    var text = rows.map(function (r) { return r.fmt.name + "\n" + r.val.textContent; }).join("\n\n");
    copyText(text, function (ok) {
      if (ok) {
        btn.textContent = "已复制";
        showAlert("已复制全部 " + FORMATS.length + " 种格式", true);
        setTimeout(function () { btn.textContent = "复制全部"; }, 1500);
      } else showAlert("复制失败，请手动选择复制", false);
    });
  });

  update();
})();
