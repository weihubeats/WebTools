/* 测试数据生成：快捷造数 + Java 类 / JSON 骨架 → 测试 JSON，零依赖 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORE = "webtools.testdata.java";
  const alertBox = $("alert");

  function showAlert(msg, ok) {
    alertBox.textContent = msg;
    alertBox.className = "alert " + (ok ? "ok" : "error");
    if (ok) setTimeout(() => { if (alertBox.classList.contains("ok")) alertBox.className = "alert"; }, 3200);
  }
  function clearAlert() { alertBox.textContent = ""; alertBox.className = "alert"; }

  function randInt(max) {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let x;
    do { crypto.getRandomValues(arr); x = arr[0]; } while (x >= limit);
    return x % max;
  }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function randDigits(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += randInt(10);
    return s;
  }
  function pad(n, w) { return String(n).padStart(w, "0"); }

  const SUR = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶司".split("");
  const GN = "伟芳娜敏静丽强磊军洋勇艳杰娟涛超秀英华慧巧美娜静淑惠珠翠雅芝玉萍红娥玲芬芳燕彩春菊兰凤洁梅琳素云莲真环雪荣爱妹霞香月莺媛艳瑞凡佳嘉怡欣雨晨阳宇浩博文安宁乐康平".split("");
  const EN_FIRST = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Alice", "Emma", "Olivia", "Noah", "Liam"];
  const EN_LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin", "Lee", "White", "Harris", "Clark", "Lewis", "Young"];
  const DOMAINS = ["example.com", "test.local", "mail.dev", "demo.io", "sample.org"];
  const PHONE_PRE = ["130", "131", "132", "133", "134", "135", "136", "137", "138", "139", "150", "151", "152", "153", "155", "156", "157", "158", "159", "166", "171", "172", "173", "175", "176", "177", "178", "180", "181", "182", "183", "185", "186", "187", "188", "189", "191", "198", "199"];
  const AREA = [
    ["110101", "北京市东城区"], ["310101", "上海市黄浦区"], ["440106", "广州市天河区"],
    ["440305", "深圳市南山区"], ["330106", "杭州市西湖区"], ["320106", "南京市鼓楼区"],
    ["510107", "成都市武侯区"], ["500103", "重庆市渝中区"], ["420106", "武汉市武昌区"],
    ["610113", "西安市雁塔区"], ["210102", "沈阳市和平区"], ["120101", "天津市和平区"]
  ];
  const STREETS = ["人民路", "中山路", "解放大道", "科技园路", "滨江大道", "学院路", "建设路", "环城西路"];
  const COMPANIES = ["星河科技", "云帆信息", "北辰数据", "青梧网络", "瀚海软件", "拾光智能", "远界互联", "木兰实验室"];
  const WORDS_ZH = ["订单", "支付", "用户", "库存", "优惠", "物流", "发票", "备注", "测试", "模拟", "渠道", "账户"];
  const WORDS_EN = ["order", "payment", "user", "stock", "coupon", "shipping", "invoice", "remark", "test", "mock", "channel", "account"];
  const PLATE_PROV = "京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼".split("");
  const PLATE_L = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

  function zhName() { return pick(SUR) + pick(GN) + (randInt(10) > 3 ? pick(GN) : ""); }
  function enName() { return pick(EN_FIRST) + " " + pick(EN_LAST); }
  function localeZh() { return $("opt-locale") && $("opt-locale").value === "en" ? false : true; }
  function personName(zh) { return (zh == null ? localeZh() : zh) ? zhName() : enName(); }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function phone() { return pick(PHONE_PRE) + randDigits(8); }
  function email(zh) {
    const n = (zh == null ? localeZh() : zh) ? "user" + randDigits(4) : pick(EN_FIRST).toLowerCase() + randDigits(3);
    return n + "@" + pick(DOMAINS);
  }
  function luhnCheck(num) {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = num.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return (10 - (sum % 10)) % 10;
  }
  function bankCard() {
    const bin = pick(["622202", "622848", "621700", "623094", "622609"]);
    const body = bin + randDigits(9);
    return body + luhnCheck(body);
  }
  function idCard() {
    const [code] = pick(AREA);
    const y = 1975 + randInt(28);
    const m = 1 + randInt(12);
    const d = 1 + randInt(28);
    const seq = pad(1 + randInt(999), 3);
    const body = code + y + pad(m, 2) + pad(d, 2) + seq;
    const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const c = "10X98765432";
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += Number(body[i]) * w[i];
    return body + c[sum % 11];
  }
  function ipv4() { return [randInt(223) + 1, randInt(256), randInt(256), randInt(254) + 1].join("."); }
  function ipv6() {
    const a = new Uint16Array(8);
    crypto.getRandomValues(a);
    return [...a].map((x) => x.toString(16)).join(":");
  }
  function mac() {
    const b = new Uint8Array(6);
    crypto.getRandomValues(b);
    b[0] = (b[0] | 0x02) & 0xfe;
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join(":");
  }
  function dateStr(offDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offDays || 0) - randInt(40));
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }
  function datetimeIso() {
    const d = new Date(Date.now() - randInt(86400 * 20) * 1000);
    return d.toISOString().slice(0, 19);
  }
  function nowFmt() {
    const mode = $("opt-time") ? $("opt-time").value : "iso";
    const d = new Date();
    if (mode === "ms") return d.getTime();
    if (mode === "s") return Math.floor(d.getTime() / 1000);
    return d.toISOString().slice(0, 19);
  }
  function address(zh) {
    if (!(zh == null ? localeZh() : zh)) {
      return (100 + randInt(8900)) + " " + pick(["Main St", "Oak Ave", "Park Rd", "Lake Dr"]) + ", " + pick(["Springfield", "Riverside", "Fairview", "Madison"]);
    }
    const [, area] = pick(AREA);
    return area + pick(STREETS) + (10 + randInt(280)) + "号" + (randInt(20) + 1) + "栋" + (randInt(18) + 1) + "单元";
  }
  function company(zh) {
    return (zh == null ? localeZh() : zh) ? pick(COMPANIES) + pick(["有限公司", "股份有限公司", "科技有限公司"]) : pick(EN_LAST) + " " + pick(["Labs", "Soft", "Systems", "Holdings"]);
  }
  function sentence(zh) {
    if (!(zh == null ? localeZh() : zh)) {
      return "This is a mock " + pick(WORDS_EN) + " record for testing #" + randDigits(3) + ".";
    }
    return "这是一条用于联调的" + pick(WORDS_ZH) + "测试数据，编号 " + randDigits(4) + "。";
  }
  function shortText(zh) {
    return (zh == null ? localeZh() : zh)
      ? "测试" + pick(WORDS_ZH) + randDigits(3)
      : "mock_" + pick(WORDS_EN) + "_" + randDigits(3);
  }
  function plate() { return pick(PLATE_PROV) + pick(PLATE_L) + "·" + (pick(PLATE_L) + randDigits(4) + pick(PLATE_L)); }
  function url() { return "https://" + pick(DOMAINS) + "/api/v1/" + pick(WORDS_EN) + "/" + randDigits(5); }
  function username() { return pick(["user", "qa", "dev", "mock"]) + "_" + randDigits(5); }
  function hexColor() { return "#" + randInt(0x1000000).toString(16).padStart(6, "0"); }
  function latlng() { return { lat: +(22 + Math.random() * 18).toFixed(6), lng: +(102 + Math.random() * 20).toFixed(6) }; }
  function money() { return +(1 + Math.random() * 9999).toFixed(2); }
  function boolVal() {
    const m = $("opt-bool") ? $("opt-bool").value : "random";
    if (m === "true") return true;
    if (m === "false") return false;
    return randInt(2) === 1;
  }

  const QUICK = [
    { id: "uuid", title: "UUID", gen: () => uuid() },
    { id: "name", title: "姓名", gen: () => personName() },
    { id: "phone", title: "手机号", gen: () => phone() },
    { id: "email", title: "邮箱", gen: () => email() },
    { id: "idcard", title: "身份证号", gen: () => idCard() },
    { id: "bank", title: "银行卡号", gen: () => bankCard() },
    { id: "ipv4", title: "IPv4", gen: () => ipv4() },
    { id: "ipv6", title: "IPv6", gen: () => ipv6() },
    { id: "mac", title: "MAC", gen: () => mac() },
    { id: "url", title: "URL", gen: () => url() },
    { id: "user", title: "用户名", gen: () => username() },
    { id: "company", title: "公司名", gen: () => company() },
    { id: "addr", title: "地址", gen: () => address() },
    { id: "date", title: "日期", gen: () => dateStr() },
    { id: "dt", title: "日期时间", gen: () => datetimeIso() },
    { id: "ts", title: "时间戳(ms)", gen: () => String(Date.now()) },
    { id: "money", title: "金额", gen: () => String(money()) },
    { id: "color", title: "颜色", gen: () => hexColor() },
    { id: "plate", title: "车牌号", gen: () => plate() },
    { id: "text", title: "短文本", gen: () => sentence() }
  ];

  function quickCount() { return Math.max(1, Math.min(20, parseInt($("quick-count").value, 10) || 1)); }
  function fillCard(id) {
    const spec = QUICK.find((x) => x.id === id);
    if (!spec) return;
    const n = quickCount();
    const vals = [];
    for (let i = 0; i < n; i++) vals.push(spec.gen());
    const el = $("q-" + id);
    el.textContent = vals.join("\n");
    el.dataset.copy = vals.join("\n");
  }
  function fillAllQuick() { QUICK.forEach((x) => fillCard(x.id)); }

  function renderQuick() {
    const grid = $("td-grid");
    grid.innerHTML = QUICK.map((x) => `
      <article class="td-card" data-id="${x.id}">
        <div class="td-head">${x.title}<span>点击结果复制</span></div>
        <div class="td-val" id="q-${x.id}" data-copy=""></div>
        <div class="td-actions">
          <button class="btn small primary" data-gen="${x.id}">生成</button>
          <button class="btn small" data-copy-btn="${x.id}">复制</button>
        </div>
      </article>`).join("");
    fillAllQuick();
  }

  /* ---------- Java parser ---------- */
  function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, "");
  }
  function readBalanced(src, start, open, close) {
    let depth = 0;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' || ch === "'") {
        const q = ch;
        i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === "\\") i++;
          i++;
        }
        continue;
      }
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return [src.slice(start + 1, i), i + 1];
      }
    }
    return [src.slice(start + 1), src.length];
  }
  function simpleName(t) {
    const s = t.replace(/<.*>/, "").replace(/\[\]/g, "").trim();
    const parts = s.split(".");
    return parts[parts.length - 1];
  }
  function splitGenericArgs(s) {
    const parts = [];
    let depth = 0, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "<") depth++;
      else if (ch === ">") depth--;
      if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  function parseType(typeStr) {
    let t = typeStr.replace(/\s+/g, " ").trim();
    let arrays = 0;
    while (/\[\s*\]$/.test(t)) {
      arrays++;
      t = t.replace(/\[\s*\]$/, "").trim();
    }
    const lt = t.indexOf("<");
    if (lt === -1) return { name: simpleName(t), raw: t, args: [], arrays };
    const inner = t.slice(lt + 1, t.lastIndexOf(">"));
    const name = simpleName(t.slice(0, lt).trim());
    return { name, raw: t, args: splitGenericArgs(inner).map(parseType), arrays };
  }
  function splitCommaDepth(s) {
    const parts = [];
    let depth = 0, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "<" || ch === "(") depth++;
      else if (ch === ">" || ch === ")") depth--;
      if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  function takeJsonProperty(stmt) {
    const m = stmt.match(/\bJsonProperty\s*\(\s*(?:value\s*=\s*)?(["'])([^"']+)\1/);
    return m ? m[2] : null;
  }
  function stripAnns(s) {
    let i = 0, out = "";
    while (i < s.length) {
      if (s[i] === "@") {
        i++;
        while (i < s.length && /[\w.$]/.test(s[i])) i++;
        while (i < s.length && /\s/.test(s[i])) i++;
        if (s[i] === "(") {
          const [, end] = readBalanced(s, i, "(", ")");
          i = end;
        }
        continue;
      }
      out += s[i++];
    }
    return out;
  }
  const MODS = /^(public|protected|private|static|final|volatile|transient|synchronized|native|abstract|default|strictfp)$/;
  function parseFieldStmt(stmt) {
    const jsonName = takeJsonProperty(stmt);
    let s = stripAnns(stmt).replace(/\s+/g, " ").trim();
    if (!s || s.startsWith("return ") || s.startsWith("throw ") || s.startsWith("new ")) return null;
    s = s.split("=")[0].trim();
    if (s.includes("(")) return null;
    const tokens = s.split(" ").filter(Boolean);
    while (tokens.length && MODS.test(tokens[0])) tokens.shift();
    if (tokens.length < 2) return null;
    if (tokens.includes("static")) return null;
    const name = tokens.pop();
    if (!/^[A-Za-z_][\w$]*$/.test(name)) return null;
    const typeStr = tokens.join(" ");
    if (!typeStr || MODS.test(typeStr)) return null;
    return { name, jsonName: jsonName || name, type: parseType(typeStr) };
  }
  function parseRecordParams(params) {
    return splitCommaDepth(params).map((p) => {
      const jsonName = takeJsonProperty(p);
      let s = stripAnns(p).replace(/\s+/g, " ").trim();
      const tokens = s.split(" ").filter(Boolean);
      while (tokens.length && MODS.test(tokens[0])) tokens.shift();
      if (tokens.length < 2) return null;
      const name = tokens.pop();
      return { name, jsonName: jsonName || name, type: parseType(tokens.join(" ")) };
    }).filter(Boolean);
  }
  function parseEnumConsts(body) {
    const head = body.split(";")[0];
    return splitCommaDepth(head).map((p) => {
      const m = p.trim().match(/^([A-Za-z_][\w$]*)/);
      return m ? m[1] : null;
    }).filter(Boolean);
  }
  function extractDecls(src) {
    const decls = [];
    const re = /\b(class|record|enum)\s+([A-Za-z_][\w$]*)/g;
    let m;
    while ((m = re.exec(src))) {
      const kind = m[1], name = m[2];
      let i = m.index + m[0].length;
      while (i < src.length && /\s/.test(src[i])) i++;
      let recordParams = "";
      if (kind === "record" && src[i] === "(") {
        const [p, end] = readBalanced(src, i, "(", ")");
        recordParams = p;
        i = end;
      }
      while (i < src.length && src[i] !== "{" && src[i] !== ";") i++;
      let body = "";
      if (src[i] === "{") {
        const [b] = readBalanced(src, i, "{", "}");
        body = b;
      }
      re.lastIndex = m.index + m[0].length;
      decls.push({ kind, name, recordParams, body });
    }
    return decls;
  }
  function fieldsOfClass(body) {
    const fields = [];
    let i = 0, depth = 0, acc = "";
    while (i < body.length) {
      const ch = body[i];
      if (ch === '"' || ch === "'") {
        const q = ch;
        acc += ch; i++;
        while (i < body.length && body[i] !== q) {
          acc += body[i];
          if (body[i] === "\\") { i++; acc += body[i] || ""; }
          i++;
        }
        acc += body[i] || "";
        i++;
        continue;
      }
      if (ch === "{") {
        if (depth === 0 && /\b(class|record|enum|interface)\b/.test(acc)) {
          const [, end] = readBalanced(body, i, "{", "}");
          i = end;
          acc = "";
          continue;
        }
        depth++;
        i++;
        continue;
      }
      if (ch === "}") { depth = Math.max(0, depth - 1); i++; continue; }
      if (depth === 0 && ch === ";") {
        const f = parseFieldStmt(acc);
        if (f) fields.push(f);
        acc = "";
        i++;
        continue;
      }
      if (depth === 0) acc += ch;
      i++;
    }
    return fields;
  }
  function pickRoot(decls) {
    const cls = decls.filter((d) => d.kind === "class" || d.kind === "record");
    if (!cls.length) return null;
    const scored = cls.map((d) => {
      const n = d.name;
      let s = 0;
      if (/(Request|Req|DTO|VO|Body|Param|Form|Query|Command)$/i.test(n)) s += 5;
      if (d.kind === "record") s += 1;
      return { d, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].d;
  }

  function toSnake(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
  }
  function keyOf(field) {
    const base = field.jsonName || field.name;
    return $("opt-keys") && $("opt-keys").value === "snake" ? toSnake(base) : base;
  }
  function listSize() { return Math.max(1, Math.min(8, parseInt($("opt-list").value, 10) || 2)); }

  const PRIM = {
    string: 1, char: 1, character: 1,
    int: 1, integer: 1, long: 1, short: 1, byte: 1,
    double: 1, float: 1, bigdecimal: 1, biginteger: 1, number: 1,
    boolean: 1, bool: 1,
    uuid: 1, date: 1, localdate: 1, localdatetime: 1, localtime: 1,
    instant: 1, zoneddatetime: 1, offsetdatetime: 1, timestamp: 1,
    object: 1, jsonnode: 1, map: 1
  };
  const COLL = { list: 1, set: 1, collection: 1, iterable: 1, arraylist: 1, linkedlist: 1, hashset: 1, treeset: 1, deque: 1, queue: 1 };

  function looks(name, re) { return re.test(name); }
  function mockByFieldName(name, zh) {
    const n = name || "";
    if (looks(n, /email|mail/i)) return email(zh);
    if (looks(n, /mobile|phone|tel|cellphone/i)) return phone();
    if (looks(n, /idcard|idNo|id_no|identity/i)) return idCard();
    if (looks(n, /bank|cardNo|card_no|accountNo/i)) return bankCard();
    if (looks(n, /password|passwd|pwd/i)) return "Test@" + randDigits(6);
    if (looks(n, /userName|username|nick|nickname/i)) return username();
    if (looks(n, /skuName|productName|itemName|goodsName|fileName/i)) return zh ? "测试" + pick(WORDS_ZH) : "Mock " + pick(WORDS_EN);
    if (looks(n, /realName|fullName|displayName|^name$/i)) return personName(zh);
    if (looks(n, /company|orgName|merchant/i)) return company(zh);
    if (looks(n, /address|addr|detailAddr|^detail$/i)) return address(zh);
    if (looks(n, /province/i)) return zh ? "广东省" : "California";
    if (looks(n, /city/i)) return zh ? "深圳市" : "San Jose";
    if (looks(n, /district|area/i)) return zh ? "南山区" : "District 9";
    if (looks(n, /zip|postcode|postal/i)) return String(100000 + randInt(800000));
    if (looks(n, /url|href|link|avatar|image|img|photo|logo/i)) return url();
    if (looks(n, /ip$/i) || looks(n, /ipAddr|ipv4/i)) return ipv4();
    if (looks(n, /mac/i)) return mac();
    if (looks(n, /email/i)) return email(zh);
    if (looks(n, /token|jwt/i)) return "tok_" + uuid().replace(/-/g, "").slice(0, 24);
    if (looks(n, /uuid|guid/i)) return uuid();
    if (looks(n, /orderNo|tradeNo|bizNo|serial|trace/i)) return "NO" + Date.now() + randDigits(3);
    if (looks(n, /sku/i)) return "SKU" + randDigits(8);
    if (looks(n, /Id$/)) return 10000 + randInt(90000);
    if (looks(n, /title|subject/i)) return zh ? "测试" + pick(WORDS_ZH) : "Mock " + pick(WORDS_EN);
    if (looks(n, /desc|remark|comment|content|message|msg|reason/i)) return sentence(zh);
    if (looks(n, /color/i)) return hexColor();
    if (looks(n, /plate|carNo|licenseNo/i)) return plate();
    if (looks(n, /lat/i)) return latlng().lat;
    if (looks(n, /lng|lon/i)) return latlng().lng;
    if (looks(n, /age/i)) return 18 + randInt(40);
    if (looks(n, /gender|sex/i)) return zh ? pick(["男", "女"]) : pick(["M", "F"]);
    if (looks(n, /status|state/i)) return pick(["PENDING", "SUCCESS", "FAILED"]);
    if (looks(n, /code$/i) && !looks(n, /zip|post/i)) return pick(["OK", "SUCCESS", "0000"]);
    if (looks(n, /count|qty|quantity|num|number|size|times|index/i)) return 1 + randInt(9);
    if (looks(n, /amount|price|money|fee|amt|pay|balance|total/i)) return money();
    if (looks(n, /percent|ratio|rate/i)) return +(Math.random()).toFixed(4);
    if (looks(n, /date$|Day$|birthday|birth/i)) return dateStr();
    if (looks(n, /time|At$|created|updated|expire|expire/i)) return nowFmt();
    return null;
  }

  function mockPrimitive(type, fieldName, zh) {
    const n = (type.name || "").toLowerCase();
    const byName = mockByFieldName(fieldName, zh);
    if (n === "string" || n === "char" || n === "character" || n === "charsequence") {
      return byName != null ? String(byName) : shortText(zh);
    }
    if (n === "boolean" || n === "bool") return typeof byName === "boolean" ? byName : boolVal();
    if (n === "int" || n === "integer" || n === "short" || n === "byte") {
      if (typeof byName === "number") return Math.trunc(byName);
      return 1 + randInt(99);
    }
    if (n === "long" || n === "biginteger") {
      if (looks(fieldName || "", /id$/i)) return 10000 + randInt(90000);
      if (typeof byName === "number") return Math.trunc(byName);
      return Date.now() - randInt(100000);
    }
    if (n === "double" || n === "float" || n === "bigdecimal" || n === "number") {
      if (typeof byName === "number") return byName;
      return money();
    }
    if (n === "uuid") return uuid();
    if (n === "localdate" || n === "date" && looks(fieldName || "", /day|date/i)) return dateStr();
    if (n === "localdate" ) return dateStr();
    if (n === "localtime") return pad(randInt(24), 2) + ":" + pad(randInt(60), 2) + ":" + pad(randInt(60), 2);
    if (n === "localdatetime" || n === "instant" || n === "zoneddatetime" || n === "offsetdatetime" || n === "timestamp" || n === "date") {
      return nowFmt();
    }
    if (n === "object" || n === "jsonnode") return byName != null ? byName : {};
    if (byName != null) return byName;
    return null;
  }

  function mockValue(type, ctx) {
    const { types, zh, path } = ctx;
    if (path.length > 8) return null;
    let t = type;
    let arr = t.arrays || 0;
    const n = (t.name || "").toLowerCase();
    if (n === "optional" && t.args[0]) return mockValue(t.args[0], ctx);
    if (COLL[n] || arr > 0) {
      const inner = arr > 0
        ? { name: t.name, raw: t.raw, args: t.args, arrays: arr - 1 }
        : (t.args[0] || { name: "String", raw: "String", args: [], arrays: 0 });
      const out = [];
      const sz = listSize();
      for (let i = 0; i < sz; i++) out.push(mockValue(inner, ctx));
      return out;
    }
    if (n === "map" || n === "hashmap" || n === "treemap" || n === "linkedhashmap") {
      const vt = t.args[1] || { name: "String", raw: "String", args: [], arrays: 0 };
      const obj = {};
      obj.demo = mockValue(vt, ctx);
      obj.other = mockValue(vt, ctx);
      return obj;
    }
    const prim = mockPrimitive(t, ctx.fieldName, zh);
    if (prim !== null && (PRIM[n] || !types[t.name])) {
      if (PRIM[n] || n === "string") return prim;
    }
    const decl = types[t.name];
    if (!decl) {
      if (prim !== null) return prim;
      const named = mockByFieldName(ctx.fieldName, zh);
      return named != null ? named : {};
    }
    if (decl.kind === "enum") return pick(decl.consts.length ? decl.consts : ["UNKNOWN"]);
    if (path.includes(t.name)) return {};
    return mockObject(decl, { types, zh, path: path.concat(t.name) });
  }

  function mockObject(decl, ctx) {
    const obj = {};
    const fields = decl.kind === "record" && decl.fields ? decl.fields : decl.fields;
    (fields || []).forEach((f) => {
      obj[keyOf(f)] = mockValue(f.type, { types: ctx.types, zh: ctx.zh, path: ctx.path, fieldName: f.name });
    });
    return obj;
  }

  function buildTypeIndex(decls) {
    const types = {};
    decls.forEach((d) => {
      if (d.kind === "enum") {
        types[d.name] = { kind: "enum", name: d.name, consts: parseEnumConsts(d.body) };
      } else if (d.kind === "record") {
        types[d.name] = { kind: "record", name: d.name, fields: parseRecordParams(d.recordParams) };
      } else {
        types[d.name] = { kind: "class", name: d.name, fields: fieldsOfClass(d.body) };
      }
    });
    return types;
  }

  function fillJsonSkeleton(node, key) {
    const zh = localeZh();
    if (Array.isArray(node)) {
      if (!node.length) return [shortText(zh)];
      const n = listSize();
      const proto = node[0];
      const out = [];
      for (let i = 0; i < n; i++) out.push(fillJsonSkeleton(proto, key));
      return out;
    }
    if (node && typeof node === "object") {
      const out = {};
      Object.keys(node).forEach((k) => { out[k] = fillJsonSkeleton(node[k], k); });
      return out;
    }
    if (typeof node === "number") {
      const named = mockByFieldName(key || "", zh);
      return typeof named === "number" ? named : (Number.isInteger(node) ? 1 + randInt(99) : money());
    }
    if (typeof node === "boolean") return boolVal();
    if (node == null) {
      const named = mockByFieldName(key || "", zh);
      return named != null ? named : null;
    }
    const named = mockByFieldName(key || "", zh);
    return named != null ? String(named) : shortText(zh);
  }

  function highlightJson(text) {
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return esc.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (m, str, colon, bool) => {
      if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`;
      if (bool) return `<span class="b">${bool}</span>`;
      if (m === "null") return `<span class="null">null</span>`;
      return `<span class="n">${m}</span>`;
    });
  }

  const MAX_AUTO = 200000;
  let lastJson = "";
  function emitJson(data) {
    const pretty = !$("opt-compact") || !$("opt-compact").checked;
    lastJson = JSON.stringify(data, null, pretty ? 2 : 0);
    const out = $("out-json");
    out.innerHTML = highlightJson(lastJson);
    out.classList.remove("placeholder");
  }
  function resetOutput(hint) {
    lastJson = "";
    const out = $("out-json");
    out.textContent = "—";
    out.classList.add("placeholder");
    $("st-root").textContent = hint || "等待输入";
  }

  // silent = 输入联动触发：不弹成功提示，解析失败只写状态栏，避免边打字边报错
  function generateFromInput(silent) {
    if (!silent) clearAlert();
    const raw = $("ta-java").value.trim();
    if (!raw) {
      resetOutput();
      clearAlert();
      if (!silent) showAlert("请粘贴 Java 类 / record，或 JSON 骨架。", false);
      return;
    }
    try { localStorage.setItem(STORE, raw); } catch (_e) {}
    if (silent && raw.length > MAX_AUTO) {
      $("st-root").textContent = "内容过大，请点「重新生成」";
      return;
    }
    const fail = (msg) => {
      $("st-root").textContent = msg;
      if (!silent) showAlert(msg, false);
    };

    if (/^[\[{]/.test(raw)) {
      try {
        const parsed = JSON.parse(raw);
        emitJson(fillJsonSkeleton(parsed, ""));
        $("st-root").textContent = "JSON 骨架 · " + (Array.isArray(parsed) ? "数组" : Object.keys(parsed).length + " 字段");
        if (!silent) showAlert("已按 JSON 骨架填充测试数据。", true);
        return;
      } catch (_e) {
        /* 不是完整 JSON，继续按 Java 解析 */
      }
    }

    const src = stripComments(raw);
    const decls = extractDecls(src);
    if (!decls.length) return fail("未识别到 class / record / enum");
    const types = buildTypeIndex(decls);
    const root = pickRoot(decls);
    if (!root) return fail("没有可生成 JSON 的 class / record");
    const fieldN = (types[root.name].fields || []).length;
    if (!fieldN) return fail("未解析到字段，继续输入…");
    const obj = mockObject(types[root.name], { types, zh: localeZh(), path: [root.name] });
    emitJson(obj);
    $("st-root").textContent = `${root.kind} ${root.name} · ${fieldN} 字段 · ${decls.length} 个类型`;
    if (!silent) showAlert(`已从 ${root.kind} ${root.name} 生成 JSON（${fieldN} 个字段，共 ${decls.length} 个类型）。`, true);
  }

  let autoTimer = null;
  function scheduleGenerate(delay) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => generateFromInput(true), delay == null ? 260 : delay);
  }

  const SAMPLE = `package com.example.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class CreateOrderRequest {
    private Long userId;
    private String orderNo;
    private String email;
    private String mobile;
    private BigDecimal amount;
    private Boolean paid;
    private List<OrderItem> items;
    private Address address;
    private LocalDateTime createdAt;
    private Status status;

    public enum Status { PENDING, PAID, CANCELLED }

    public static class OrderItem {
        private String skuId;
        private String skuName;
        private Integer quantity;
        private BigDecimal price;
    }

    public static class Address {
        private String province;
        private String city;
        private String detail;
        @com.fasterxml.jackson.annotation.JsonProperty("zip_code")
        private String zipCode;
    }
}`;

  function setMode(mode) {
    document.querySelectorAll(".td-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("panel-quick").classList.toggle("active", mode === "quick");
    $("panel-java").classList.toggle("active", mode === "java");
  }

  function copyText(text, okMsg) {
    if (!text) return showAlert("暂无内容可复制。", false);
    navigator.clipboard.writeText(text).then(
      () => showAlert(okMsg || "已复制。", true),
      () => showAlert("复制失败，请手动选中。", false)
    );
  }

  $("td-grid").addEventListener("click", (e) => {
    const gen = e.target.closest("[data-gen]");
    if (gen) return fillCard(gen.getAttribute("data-gen"));
    const copyBtn = e.target.closest("[data-copy-btn]");
    if (copyBtn) {
      const el = $("q-" + copyBtn.getAttribute("data-copy-btn"));
      return copyText(el.dataset.copy || el.textContent, "已复制。");
    }
    const val = e.target.closest(".td-val");
    if (val) copyText(val.dataset.copy || val.textContent, "已复制。");
  });
  $("btn-quick-all").addEventListener("click", () => { fillAllQuick(); showAlert("已刷新全部快捷数据。", true); });
  $("quick-count").addEventListener("change", fillAllQuick);
  $("opt-locale-quick").addEventListener("change", () => {
    $("opt-locale").value = $("opt-locale-quick").value;
    fillAllQuick();
  });
  $("opt-locale").addEventListener("change", () => {
    $("opt-locale-quick").value = $("opt-locale").value;
  });

  document.querySelectorAll(".td-mode").forEach((b) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });
  const ta = $("ta-java");
  ta.addEventListener("input", () => scheduleGenerate());
  ta.addEventListener("paste", () => scheduleGenerate(40));

  $("btn-gen-json").addEventListener("click", () => generateFromInput(false));
  $("btn-sample").addEventListener("click", () => {
    ta.value = SAMPLE;
    generateFromInput(false);
  });
  $("btn-clear-java").addEventListener("click", () => {
    clearTimeout(autoTimer);
    ta.value = "";
    resetOutput();
    clearAlert();
    try { localStorage.removeItem(STORE); } catch (_e) {}
  });
  $("btn-copy-json").addEventListener("click", () => copyText(lastJson, "已复制 JSON。"));
  $("btn-download").addEventListener("click", () => {
    if (!lastJson) return showAlert("请先生成 JSON。", false);
    const blob = new Blob([lastJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "testdata.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  ["opt-list", "opt-keys", "opt-time", "opt-bool", "opt-compact", "opt-locale"].forEach((id) => {
    $(id).addEventListener("change", () => {
      if (ta.value.trim()) generateFromInput(true);
    });
  });

  renderQuick();
  resetOutput();
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      ta.value = saved;
      generateFromInput(true);
    }
  } catch (_e) {}
})();
