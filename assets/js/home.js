/* WebTools 首页交互：Hero 搜索过滤 / 分类 Tabs / 主题切换
   顶部导航与 ⌘K 快速跳转由 assets/js/site-nav.js 负责 */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 工具数据（从 DOM 卡片读取，保持单一数据源） ---------- */
  var cards = $$(".card").map(function (el) {
    return {
      el: el,
      href: el.getAttribute("href"),
      title: $("h3", el).textContent.replace("↗", "").trim(),
      desc: $("p", el).textContent.trim(),
      cat: el.dataset.cat,
      hot: el.dataset.hot === "1",
      kw: (el.dataset.kw || "") + " " + $("h3", el).textContent + " " + $("p", el).textContent
    };
  });
  var TOTAL = cards.length;
  var state = { cat: "all", q: "" };

  /* ---------- 深浅主题 ---------- */
  $("#theme-toggle").addEventListener("click", function () {
    var dark = document.documentElement.getAttribute("data-theme") !== "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("webtools.theme", dark ? "dark" : "light"); } catch (e) {}
    moveIndicator();
  });

  /* ---------- 过滤（Tabs ∩ 搜索词） ---------- */
  function filter() {
    var q = state.q.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (c) {
      var byCat =
        state.cat === "all" ? true :
        state.cat === "hot" ? c.hot :
        c.cat === state.cat;
      var byQ = !q || c.kw.toLowerCase().indexOf(q) !== -1;
      var show = byCat && byQ;
      c.el.hidden = !show;
      if (show) visible++;
    });
    $("#tabs-count").textContent = visible + " / " + TOTAL + " 个工具";
    $("#hs-count").textContent = visible + " 个工具";
    $("#empty").classList.toggle("show", visible === 0);
    $("#grid").style.display = visible === 0 ? "none" : "";
  }

  /* ---------- 分类 Tabs（滑动指示器） ---------- */
  var tabs = $$(".tab");
  var ind = $("#tab-ind");

  function moveIndicator() {
    var active = $(".tab.active");
    if (!active) return;
    ind.style.width = active.offsetWidth + "px";
    ind.style.transform = "translateX(" + active.offsetLeft + "px)";
    ind.style.top = active.offsetTop + "px";
    ind.style.height = active.offsetHeight + "px";
    ind.style.marginTop = "0";
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      state.cat = tab.dataset.cat;
      moveIndicator();
      filter();
    });
  });
  window.addEventListener("resize", moveIndicator);

  /* ---------- Hero 宽幅搜索 ---------- */
  var hs = $("#hs");
  var heroBox = $("#hero-search");
  hs.addEventListener("input", function () {
    state.q = hs.value;
    heroBox.classList.toggle("has-text", !!hs.value);
    filter();
  });
  $("#hs-clear").addEventListener("click", function () {
    hs.value = "";
    state.q = "";
    heroBox.classList.remove("has-text");
    filter();
    hs.focus();
  });

  /* ---------- 启动 ---------- */
  filter();
  moveIndicator();
  document.fonts && document.fonts.ready.then(moveIndicator);
})();
