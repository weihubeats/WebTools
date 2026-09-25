/* YAML 格式化 / 校验 + YAML ⇄ Properties 转换：零依赖（解析器手写子集实现） */
var YamlKit = (function () {
  "use strict";

  function YErr(msg, line) {
    const e = new Error(msg);
    e.name = "YamlError";
    e.line = line || 0;
    return e;
  }

  // ===================== YAML 解析 =====================

  function isSeqLine(c) {
    return c === "-" || c.startsWith("- ");
  }

  // 找到映射分隔 ':'（后随空格或行尾，且不在引号 / 流式集合内）
  function findKeySplit(s) {
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "'") {
        i++;
        while (i < s.length) {
          if (s[i] === "'") {
            if (s[i + 1] === "'") { i += 2; continue; }
            i++; break;
          }
          i++;
        }
        continue;
      }
      if (c === '"') {
        i++;
        while (i < s.length) {
          if (s[i] === "\\") { i += 2; continue; }
          if (s[i] === '"') { i++; break; }
          i++;
        }
        continue;
      }
      if (c === "[" || c === "{") {
        let depth = 0;
        const start = i;
        // 粗略跳过流式集合（允许嵌套）
        while (i < s.length) {
          const d = s[i];
          if (d === "'" || d === '"') {
            const q = d; i++;
            while (i < s.length) {
              if (q === '"' && s[i] === "\\") { i += 2; continue; }
              if (s[i] === q) { i++; break; }
              i++;
            }
            continue;
          }
          if (d === "[" || d === "{") depth++;
          else if (d === "]" || d === "}") {
            depth--;
            if (depth <= 0) { i++; break; }
          }
          i++;
        }
        if (i <= start) i++;
        continue;
      }
      if (c === ":" && (i + 1 >= s.length || s[i + 1] === " ")) return i;
      i++;
    }
    return -1;
  }

  function cutComment(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "#" && (i === 0 || /\s/.test(s[i - 1]))) {
        return s.slice(0, i).replace(/\s+$/, "");
      }
    }
    return s;
  }

  function toScalar(s) {
    if (s === "" ) return "";
    if (s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
    if (s === "true" || s === "True" || s === "TRUE") return true;
    if (s === "false" || s === "False" || s === "FALSE") return false;
    if (/^[+-]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][+-]?[0-9]+)?$/.test(s)) {
      const n = Number(s);
      if (!isNaN(n) && isFinite(n)) return n;
    }
    return s;
  }

  function parseYaml(text) {
    if (typeof text === "string" && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    const lines = [];
    const warnings = [];
    for (let n = 0; n < raw.length; n++) {
      const no = n + 1;
      let s = raw[n];
      const t = s.trim();
      if (t === "---" || t.startsWith("--- #")) {
        if (lines.length === 0) continue; // 文档起始标记
        warnings.push("检测到多文档（---），仅解析第一份");
        break;
      }
      if (t === "...") break;
      const m = /^([ \t]*)/.exec(s);
      if (m[1].indexOf("\t") >= 0) throw YErr("缩进不允许使用 Tab", no);
      s = s.replace(/[ \t]+$/, "");
      lines.push({ indent: m[1].length, content: s.slice(m[1].length), no: no });
    }

    const st = { lines: lines, i: 0, anchors: {} };

    function skip() {
      while (st.i < st.lines.length) {
        const c = st.lines[st.i].content;
        if (c === "" || c[0] === "#") st.i++;
        else break;
      }
    }
    function cur() { return st.lines[st.i]; }
    function err(msg, no) { throw YErr(msg, no); }

    // ---- 引号标量 ----
    function parseQuoted(s, start, lineNo) {
      const q = s[start];
      let i = start + 1;
      let out = "";
      if (q === "'") {
        while (i < s.length) {
          if (s[i] === "'") {
            if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
            return { value: out, end: i + 1 };
          }
          out += s[i]; i++;
        }
        err("单引号未闭合", lineNo);
      } else {
        while (i < s.length) {
          const c = s[i];
          if (c === '"') return { value: out, end: i + 1 };
          if (c === "\\") {
            const e = s[i + 1];
            if (e === undefined) err("反斜杠转义不完整", lineNo);
            i += 2;
            switch (e) {
              case "n": out += "\n"; break;
              case "t": out += "\t"; break;
              case "r": out += "\r"; break;
              case "0": out += "\0"; break;
              case "b": out += "\b"; break;
              case "f": out += "\f"; break;
              case "v": out += "\v"; break;
              case '"': out += '"'; break;
              case "\\": out += "\\"; break;
              case "/": out += "/"; break;
              case " ": out += " "; break;
              case "u": case "x": {
                const len = e === "u" ? 4 : 2;
                const hex = s.slice(i, i + len);
                if (!new RegExp("^[0-9a-fA-F]{" + len + "}$").test(hex)) err("无效的 \\u / \\x 转义", lineNo);
                out += String.fromCharCode(parseInt(hex, 16));
                i += len;
                break;
              }
              default:
                if (e === "\n") { /* 行折叠续行：宽松处理 */ }
                else out += e;
            }
            continue;
          }
          out += c; i++;
        }
        err("双引号未闭合", lineNo);
      }
      return { value: out, end: i };
    }

    // ---- 流式集合 [..] {..}（单行） ----
    function parseFlow(s, lineNo) {
      let i = 0;
      function ws() { while (i < s.length && (s[i] === " " || s[i] === "\t")) i++; }
      function value() {
        ws();
        if (i >= s.length) err("流式集合意外结束", lineNo);
        const c = s[i];
        if (c === "[") {
          i++;
          const arr = [];
          ws();
          if (s[i] === "]") { i++; return arr; }
          for (;;) {
            arr.push(value());
            ws();
            if (s[i] === ",") { i++; continue; }
            if (s[i] === "]") { i++; return arr; }
            err("数组缺少 ',' 或 ']'", lineNo);
          }
        }
        if (c === "{") {
          i++;
          const obj = {};
          ws();
          if (s[i] === "}") { i++; return obj; }
          for (;;) {
            const k = value();
            ws();
            if (s[i] !== ":") err("映射缺少 ':'", lineNo);
            i++;
            const v = value();
            obj[String(k)] = v;
            ws();
            if (s[i] === ",") { i++; continue; }
            if (s[i] === "}") { i++; return obj; }
            err("映射缺少 ',' 或 '}'", lineNo);
          }
        }
        if (c === "'" || c === '"') {
          const r = parseQuoted(s, i, lineNo);
          i = r.end;
          return r.value;
        }
        // plain 标量：到 , ] } 或 ": " 为止
        const from = i;
        while (i < s.length) {
          const d = s[i];
          if (d === "," || d === "]" || d === "}") break;
          if (d === ":" && (i + 1 >= s.length || s[i + 1] === " " || s[i + 1] === "," || s[i + 1] === "]" || s[i + 1] === "}")) break;
          i++;
        }
        const seg = s.slice(from, i).trim();
        if (seg === "" ) err("流式集合存在空元素", lineNo);
        return toScalar(seg);
      }
      const val = value();
      ws();
      const tail = s.slice(i).trim();
      if (tail !== "" && tail[0] !== "#") err("流式集合后存在多余内容", lineNo);
      return val;
    }

    // ---- 行内值 ----
    function parseInlineValue(s, lineNo) {
      s = s.trim();
      if (s[0] === "[" || s[0] === "{") return parseFlow(s, lineNo);
      if (s[0] === "'" || s[0] === '"') {
        const r = parseQuoted(s, 0, lineNo);
        const tail = s.slice(r.end).trim();
        if (tail !== "" && tail[0] !== "#") err("引号后存在多余内容", lineNo);
        return r.value;
      }
      return toScalar(cutComment(s));
    }

    // ---- 块标量 | > ----
    function parseBlockScalar(parentIndent, header, lineNo) {
      const h = cutComment(header.trim());
      const style = h[0];
      const dm = /^[|>]([0-9]*)/.exec(h);
      const explicit = dm && dm[1] ? parseInt(dm[1], 10) : 0;
      let chomp = "";
      const cm = /[+-]/.exec(h);
      if (cm) chomp = cm[0];

      const raw = [];
      let contentIndent = explicit || null;
      while (st.i < st.lines.length) {
        const l = st.lines[st.i];
        if (l.content === "") { raw.push(""); st.i++; continue; }
        if (l.indent <= parentIndent) break;
        if (contentIndent === null) contentIndent = l.indent;
        if (l.indent < contentIndent) break;
        raw.push(" ".repeat(l.indent - contentIndent) + l.content);
        st.i++;
      }
      // 去掉尾部空行（chomping 再统一处理）
      let out;
      if (style === "|") {
        out = raw.join("\n");
      } else {
        out = "";
        let first = true, prevEmpty = false;
        for (const ln of raw) {
          if (ln === "") { out += "\n"; prevEmpty = true; continue; }
          if (first) { out += ln; first = false; }
          else if (prevEmpty) out += "\n" + ln;
          else out += " " + ln;
          prevEmpty = false;
        }
      }
      if (chomp === "-") out = out.replace(/\n+$/, "");
      else if (chomp === "+") { if (out !== "" && !out.endsWith("\n")) out += "\n"; }
      else out = out === "" ? "" : out.replace(/\n+$/, "") + "\n";
      return out;
    }

    // ---- 值（key: 后 / 序列项） ----
    function valueFromRest(rest, parentIndent, lineNo) {
      rest = rest.trim();
      if (rest[0] === "*") {
        const name = rest.slice(1).trim();
        if (!(name in st.anchors)) err("未找到别名 *" + name, lineNo);
        return st.anchors[name];
      }
      let anchor = null;
      const am = /^&([^\s]+)(\s+|$)/.exec(rest);
      if (am) { anchor = am[1]; rest = rest.slice(am[0].length); }
      const tm = /^!{1,2}[^\s]+\s+/.exec(rest);
      if (tm) rest = rest.slice(tm[0].length);

      let val;
      if (rest === "") {
        skip();
        if (st.i >= st.lines.length || cur().indent <= parentIndent) val = null;
        else val = parseNodeAt(cur().indent);
      } else if (rest[0] === "|" || rest[0] === ">") {
        val = parseBlockScalar(parentIndent, rest, lineNo);
      } else {
        val = parseInlineValue(rest, lineNo);
      }
      if (anchor) st.anchors[anchor] = val;
      return val;
    }

    function parseMap(ind) {
      const obj = {};
      for (;;) {
        skip();
        if (st.i >= st.lines.length) break;
        const l = cur();
        if (l.indent < ind) break;
        if (l.indent > ind) err("缩进不一致（期望 " + ind + " 列，实际 " + l.indent + " 列）", l.no);
        if (isSeqLine(l.content)) err("映射中出现序列行", l.no);
        const ks = findKeySplit(l.content);
        if (ks < 0) err("缺少 ':'，无法解析映射行", l.no);
        const keyRaw = l.content.slice(0, ks).trim();
        let key;
        if (keyRaw[0] === "'" || keyRaw[0] === '"') {
          const r = parseQuoted(keyRaw, 0, l.no);
          key = r.value;
        } else key = keyRaw;
        if (key === "") err("键名为空", l.no);
        const rest = l.content.slice(ks + 1).trim();
        st.i++;
        obj[key] = valueFromRest(rest, ind, l.no);
      }
      return obj;
    }

    function parseSeq(ind) {
      const arr = [];
      for (;;) {
        skip();
        if (st.i >= st.lines.length) break;
        const l = cur();
        if (l.indent < ind) break;
        if (l.indent > ind) err("缩进不一致（序列期望 " + ind + " 列，实际 " + l.indent + " 列）", l.no);
        if (!isSeqLine(l.content)) break;
        const after = l.content.slice(1);
        const lead = after.length - after.replace(/^ +/, "").length;
        const rest = after.replace(/^ +/, "");
        const restOffset = l.indent + 1 + lead;
        if (rest === "") {
          st.i++;
          skip();
          if (st.i >= st.lines.length || cur().indent <= ind) arr.push(null);
          else arr.push(parseNodeAt(cur().indent));
          continue;
        }
        if (rest === "-" || rest.startsWith("- ")) {
          st.lines[st.i] = { indent: restOffset, content: rest, no: l.no };
          arr.push(parseSeq(restOffset));
          continue;
        }
        if (findKeySplit(rest) >= 0) {
          st.lines[st.i] = { indent: restOffset, content: rest, no: l.no };
          arr.push(parseMap(restOffset));
          continue;
        }
        st.i++;
        arr.push(valueFromRest(rest, ind, l.no));
      }
      return arr;
    }

    function parseNodeAt(ind) {
      const l = cur();
      if (isSeqLine(l.content)) return parseSeq(l.indent);
      if (findKeySplit(l.content) >= 0) return parseMap(l.indent);
      st.i++;
      return parseInlineValue(l.content, l.no);
    }

    skip();
    if (st.i >= st.lines.length) return { value: null, warnings: warnings, empty: true };
    const first = cur();
    let value;
    if (isSeqLine(first.content)) value = parseSeq(first.indent);
    else if (findKeySplit(first.content) >= 0) value = parseMap(first.indent);
    else { st.i++; value = parseInlineValue(first.content, first.no); }
    skip();
    if (st.i < st.lines.length) {
      const l = cur();
      err("无法解析的内容（缩进不一致或结构错误）", l.no);
    }
    return { value: value, warnings: warnings, empty: false };
  }

  // ===================== YAML 输出 =====================

  function needQuote(s) {
    if (s === "") return true;
    if (/^(~|null|Null|NULL|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$/.test(s)) return true;
    if (/^[+-]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][+-]?[0-9]+)?$/.test(s)) return true;
    if (/^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}/.test(s)) return true;
    if (/^\s|\s$/.test(s)) return true;
    if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return true;
    if (/[:#]/.test(s) && /(: |:$| #)/.test(s)) return true;
    if (/[\u0000-\u001f\u007f]/.test(s)) return true;
    return false;
  }

  function quoteStr(s) {
    if (/[\u0000-\u001f\u007f]/.test(s)) return JSON.stringify(s); // 控制字符 → 双引号转义
    if (s.includes("'")) return JSON.stringify(s); // 含单引号 → 双引号
    return "'" + s + "'"; // 含特殊符号但无控制字符 → 单引号（反斜杠原样保留）
  }

  function scalarStr(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return isFinite(v) ? String(v) : JSON.stringify(String(v));
    const s = String(v);
    if (!needQuote(s)) return s;
    return quoteStr(s);
  }

  function quoteKey(k) {
    const s = String(k);
    if (needQuote(s)) return quoteStr(s);
    return s;
  }

  function isContainer(v) {
    return v !== null && typeof v === "object";
  }

  function dumpYaml(value, opts) {
    opts = opts || {};
    const ind = opts.indent === 4 ? 4 : 2;
    const sort = !!opts.sortKeys;

    function emit(v, depth) {
      const pad = new Array(depth * ind + 1).join(" ");
      if (Array.isArray(v)) {
        if (v.length === 0) return [pad + "[]"];
        return v.map(function (item) {
          if (!isContainer(item)) return pad + "- " + scalarStr(item);
          if (Array.isArray(item) && item.length === 0) return pad + "- []";
          if (!Array.isArray(item) && Object.keys(item).length === 0) return pad + "- {}";
          const sub = emit(item, depth + 1);
          sub[0] = pad + "- " + sub[0].slice((depth + 1) * ind);
          return sub;
        }).reduce(function (a, b) { return a.concat(b); }, []);
      }
      if (isContainer(v)) {
        let keys = Object.keys(v);
        if (keys.length === 0) return [pad + "{}"];
        if (sort) keys = keys.slice().sort();
        const out = [];
        for (const k of keys) {
          const val = v[k];
          const ks = quoteKey(k);
          if (!isContainer(val)) {
            out.push(pad + ks + ": " + scalarStr(val));
          } else if (Array.isArray(val)) {
            if (val.length === 0) out.push(pad + ks + ": []");
            else {
              out.push(pad + ks + ":");
              for (const ln of emit(val, depth + 1)) out.push(ln);
            }
          } else {
            if (Object.keys(val).length === 0) out.push(pad + ks + ": {}");
            else {
              out.push(pad + ks + ":");
              for (const ln of emit(val, depth + 1)) out.push(ln);
            }
          }
        }
        return out;
      }
      return [pad + scalarStr(v)];
    }

    if (!isContainer(value)) return scalarStr(value) + "\n";
    const lines = emit(value, 0);
    return lines.length ? lines.join("\n") + "\n" : "";
  }

  function countKeys(v) {
    let n = 0;
    if (Array.isArray(v)) {
      for (const it of v) n += countKeys(it);
    } else if (isContainer(v)) {
      for (const k of Object.keys(v)) { n++; n += countKeys(v[k]); }
    }
    return n;
  }

  function countLeaves(v) {
    let n = 0;
    if (Array.isArray(v)) {
      for (const it of v) n += countLeaves(it);
    } else if (isContainer(v)) {
      for (const k of Object.keys(v)) n += countLeaves(v[k]);
    } else n++;
    return n;
  }

  // ===================== Properties 转换 =====================

  function escKey(s) {
    let out = "";
    for (const ch of String(s)) {
      if (ch === "\\" ) out += "\\\\";
      else if (ch === " ") out += "\\ ";
      else if (ch === "=" || ch === ":" || ch === "#" || ch === "!") out += "\\" + ch;
      else if (ch === "\t") out += "\\t";
      else out += ch;
    }
    return out;
  }

  function escVal(s) {
    s = String(s);
    let out = "";
    let i = 0;
    while (i < s.length && (s[i] === " " || s[i] === "\t")) { out += s[i] === " " ? "\\ " : "\\t"; i++; } // 防止前导空白被吃掉
    for (; i < s.length; i++) {
      const ch = s[i];
      if (ch === "\\") out += "\\\\";
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else out += ch;
    }
    return out;
  }

  function valToString(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return "";
    return String(v);
  }

  function toProps(value, opts) {
    opts = opts || {};
    const style = opts.arrayStyle === "dot" ? "dot" : "index";
    const lines = [];
    function walk(v, key) {
      if (Array.isArray(v)) {
        if (v.length === 0) { lines.push(escKey(key) + "="); return; }
        v.forEach(function (it, i) {
          const child = style === "dot" ? key + "." + i : key + "[" + i + "]";
          walk(it, child);
        });
        return;
      }
      if (isContainer(v)) {
        const ks = Object.keys(v);
        if (ks.length === 0) { lines.push(escKey(key) + "="); return; }
        for (const k of ks) {
          walk(v[k], key === "" ? k : key + "." + k);
        }
        return;
      }
      lines.push(escKey(key) + "=" + escVal(valToString(v)));
    }
    walk(value, "");
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  function unesc(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c !== "\\") { out += c; continue; }
      const e = s[i + 1];
      if (e === undefined) { out += "\\"; break; }
      i++;
      switch (e) {
        case "n": out += "\n"; break;
        case "t": out += "\t"; break;
        case "r": out += "\r"; break;
        case "f": out += "\f"; break;
        case "u": {
          const hex = s.slice(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) { out += String.fromCharCode(parseInt(hex, 16)); i += 4; }
          else out += "u";
          break;
        }
        default: out += e;
      }
    }
    return out;
  }

  function splitPropKey(key) {
    // 拆成片段（保留转义，稍后逐段 unesc）：a.b\[x\].c[0] → [k:a, k:b[x], k:c, i:0]
    const parts = [];
    let buf = "";
    function flush() { if (buf !== "") { parts.push({ t: "k", v: buf }); buf = ""; } }
    for (let i = 0; i < key.length; i++) {
      const c = key[i];
      if (c === "\\" && i + 1 < key.length) { buf += c + key[i + 1]; i++; continue; }
      if (c === ".") { flush(); continue; }
      if (c === "[") {
        const end = key.indexOf("]", i);
        if (end > i && /^[0-9]+$/.test(key.slice(i + 1, end))) {
          flush();
          parts.push({ t: "i", v: parseInt(key.slice(i + 1, end), 10) });
          i = end;
          continue;
        }
      }
      buf += c;
    }
    flush();
    return parts;
  }

  function fromProps(text) {
    const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");

    // 行延续：行尾奇数个反斜杠 → 去掉反斜杠并拼接下一行（跳过下一行前导空白）
    function oddBackslash(s) {
      let n = 0;
      for (let i = s.length - 1; i >= 0 && s[i] === "\\"; i--) n++;
      return n % 2 === 1;
    }
    const logical = [];
    for (let i = 0; i < raw.length; i++) {
      let line = raw[i];
      while (oddBackslash(line) && i + 1 < raw.length) {
        line = line.slice(0, -1) + raw[i + 1].replace(/^[ \t]+/, "");
        i++;
      }
      logical.push(line);
    }

    const root = {};
    for (let line of logical) {
      line = line.replace(/^[ \t]+/, "");
      if (line === "" || line[0] === "#" || line[0] === "!") continue;
      let sep = -1;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "\\") { i++; continue; }
        if (line[i] === "=" || line[i] === ":") { sep = i; break; }
      }
      const rawKey = sep < 0 ? line : line.slice(0, sep);
      const rawVal = sep < 0 ? "" : line.slice(sep + 1).replace(/^[ \t]+/, "");
      const parts = splitPropKey(rawKey);
      if (!parts.length) continue;
      if (parts[0].t === "i") continue; // 顶层不支持 [0] 开头
      const val = unesc(rawVal);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const last = i === parts.length - 1;
        const key = p.t === "k" ? unesc(p.v) : null;
        if (last) {
          if (p.t === "k") node[key] = val;
          else if (Array.isArray(node)) node[p.v] = val;
          continue;
        }
        const next = parts[i + 1];
        let child;
        if (p.t === "k") child = node[key];
        else child = Array.isArray(node) ? node[p.v] : undefined;
        if (next.t === "i") {
          if (!Array.isArray(child)) child = [];
        } else {
          if (typeof child !== "object" || child === null || Array.isArray(child)) child = {};
        }
        if (p.t === "k") node[key] = child;
        else if (Array.isArray(node)) node[p.v] = child;
        node = child;
      }
    }
    return root;
  }

  return {
    parse: parseYaml,
    dump: dumpYaml,
    format: function (text, opts) {
      const r = parseYaml(text);
      return { text: dumpYaml(r.value, opts), value: r.value, warnings: r.warnings };
    },
    toProps: toProps,
    fromProps: fromProps,
    countKeys: countKeys,
    countLeaves: countLeaves
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YamlKit;

// ===================== UI =====================
if (typeof document !== "undefined") (function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const taIn = $("ta-in"), taOut = $("ta-out");
  const hlIn = $("hl-in"), hlOut = $("hl-out");
  const gutIn = $("gut-in-inner"), gutOut = $("gut-out-inner");
  const paneIn = $("pane-in"), paneOut = $("pane-out");
  const chkLive = $("chk-live"), selIndent = $("sel-indent"), selArr = $("sel-array");
  const toastEl = $("toast");

  let mode = "format"; // format | convert | validate
  let dir = "y2p";     // convert 方向：y2p | p2y
  let errLine = 0;
  let lock = false, timer = null;

  const SAMPLE_YAML = [
    "# WebTools YAML 示例",
    "server:",
    "  port: 8080",
    "  context-path: /api",
    "  hosts:",
    "    - 10.0.0.1",
    "    - 10.0.0.2",
    "spring:",
    "  datasource:",
    "    url: jdbc:mysql://localhost:3306/app",
    "    username: root",
    '    password: "p@ss: word"  # 引号内 # 不是注释',
    "    driver-class-name: com.mysql.cj.jdbc.Driver",
    "  profiles:",
    "    active: [dev, prod]",
    "logging:",
    "  level:",
    "    root: INFO",
    "    com.example: DEBUG",
    "enabled: true",
    "timeout: 3000",
    "empty-value:",
    "limits:",
    "  max-connections: 100",
    "  banner: |",
    "    第一行",
    "    第二行"
  ].join("\n");

  const SAMPLE_PROPS = [
    "# WebTools Properties 示例",
    "server.port=8080",
    "server.context-path=/api",
    "server.hosts[0]=10.0.0.1",
    "server.hosts[1]=10.0.0.2",
    "spring.datasource.url=jdbc:mysql://localhost:3306/app",
    "spring.datasource.username=root",
    "spring.datasource.password=p\\@ss",
    "spring.profiles.active=dev,prod",
    "enabled=true",
    "timeout=3000"
  ].join("\n");

  // ---------- 语言 / 模式 ----------
  function inputLang() { return mode === "convert" && dir === "p2y" ? "properties" : "yaml"; }
  function outputLang() {
    if (mode === "validate") return "report";
    if (mode === "convert") return dir === "y2p" ? "properties" : "yaml";
    return "yaml";
  }
  function modeText() {
    if (mode === "format") return "YAML 格式化";
    if (mode === "validate") return "语法校验";
    return dir === "y2p" ? "YAML -> Properties" : "Properties -> YAML";
  }

  // ---------- 状态 / Toast ----------
  function setStatus(kind, text, msg) {
    $("st-dot").className = "st-dot" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    $("st-status").textContent = text;
    const m = $("st-msg");
    m.textContent = msg || "";
    m.className = "st-msg" + (kind === "err" ? " err" : "");
  }
  let toastTimer = null;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = "toast"; }, 2600);
  }

  // ---------- 高亮 ----------
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function sp(cls, s) { return s ? '<span class="' + cls + '">' + esc(s) + "</span>" : ""; }

  // 映射分隔 ':'（后随空白或行尾，不在引号内）
  function findColon(s) {
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "'" || c === '"') {
        i++;
        while (i < s.length) {
          if (c === "'" && s[i] === "'" && s[i + 1] === "'") { i += 2; continue; }
          if (c === '"' && s[i] === "\\") { i += 2; continue; }
          if (s[i] === c) { i++; break; }
          i++;
        }
        continue;
      }
      if (c === "[" || c === "{") {
        let depth = 0;
        while (i < s.length) {
          const d = s[i];
          if (d === "'" || d === '"') {
            const q = d; i++;
            while (i < s.length) {
              if (q === '"' && s[i] === "\\") { i += 2; continue; }
              if (s[i] === q) { i++; break; }
              i++;
            }
            continue;
          }
          if (d === "[" || d === "{") depth++;
          else if (d === "]" || d === "}") { depth--; if (depth <= 0) { i++; break; } }
          i++;
        }
        continue;
      }
      if (c === ":" && (i + 1 >= s.length || s[i + 1] === " " || s[i + 1] === "\t")) return i;
      i++;
    }
    return -1;
  }

  function hlValue(v) {
    if (v === "") return "";
    const t = v.replace(/^[ \t]+/, "");
    const lead = v.slice(0, v.length - t.length);
    if (t === "") return esc(lead);
    if (t[0] === "#") return esc(lead) + sp("c", t);
    if (t[0] === "'" || t[0] === '"') {
      const q = t[0];
      let i = 1;
      while (i < t.length) {
        if (q === '"' && t[i] === "\\") { i += 2; continue; }
        if (t[i] === q) { i++; break; }
        i++;
      }
      const end = i < t.length ? i : t.length;
      let out = esc(lead) + sp("s", t.slice(0, end));
      const rest = t.slice(end);
      const cm = /(^|\s)#/.exec(rest);
      if (cm) out += esc(rest.slice(0, cm.index)) + sp("c", rest.slice(cm.index));
      else out += esc(rest);
      return out;
    }
    let body = t, cm = "";
    const m = /(^|\s)#/.exec(t);
    if (m) { body = t.slice(0, m.index); cm = t.slice(m.index); }
    const b = body.replace(/[ \t]+$/, "");
    const trail = body.slice(b.length);
    let out = esc(lead);
    if (t[0] === "[" || t[0] === "{") out += sp("s", b);
    else if (/^(true|false|null|~|True|False|Null|TRUE|FALSE|NULL)$/.test(b)) out += sp("b", b);
    else if (/^[+-]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][+-]?[0-9]+)?$/.test(b)) out += sp("n", b);
    else out += sp("s", b);
    out += esc(trail);
    if (cm) out += sp("c", cm);
    return out;
  }

  function hlYamlLine(raw) {
    if (raw === "") return "";
    if (/^[ \t]*#/.test(raw)) return sp("c", raw);
    const indent = /^[ \t]*/.exec(raw)[0];
    let out = esc(indent);
    let rest = raw.slice(indent.length);
    if (rest === "-" || rest.startsWith("- ")) {
      out += sp("d", "-");
      rest = rest.slice(1);
      if (rest[0] === " ") { out += " "; rest = rest.slice(1); }
    }
    if (!rest) return out;
    const ci = findColon(rest);
    if (ci >= 0) {
      out += sp("k", rest.slice(0, ci + 1));
      out += hlValue(rest.slice(ci + 1));
    } else {
      out += hlValue(rest);
    }
    return out;
  }

  function hlPropsLine(raw) {
    if (raw === "") return "";
    if (/^[ \t]*[#!]/.test(raw)) return sp("c", raw);
    let sep = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === "\\") { i++; continue; }
      if (raw[i] === "=" || raw[i] === ":") { sep = i; break; }
    }
    if (sep < 0) return sp("s", raw);
    let out = sp("k", raw.slice(0, sep)) + sp("p", raw[sep]);
    const val = raw.slice(sep + 1);
    const cm = /(^|\s)#/.exec(val);
    if (cm) out += sp("s", val.slice(0, cm.index)) + sp("c", val.slice(cm.index));
    else out += sp("s", val);
    return out;
  }

  const HL_MAX = 400000;
  function renderPane(ta, hl, gut, isInput) {
    const v = ta.value;
    const lines = v === "" ? 1 : v.split("\n").length;
    let g = "";
    for (let i = 1; i <= lines; i++) {
      g += '<span class="ln' + (isInput && i === errLine ? " err" : "") + '">' + i + "</span>";
    }
    gut.innerHTML = g;
    if (!v) { hl.innerHTML = ""; return; }
    if (v.length > HL_MAX) { hl.textContent = v; return; }
    const lang = isInput ? inputLang() : outputLang();
    const fn = lang === "yaml" ? hlYamlLine : lang === "properties" ? hlPropsLine : null;
    if (!fn) { hl.textContent = v; return; }
    hl.innerHTML = v.split("\n").map(fn).join("\n");
  }

  function syncScroll(ta, hl, gut) {
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
    gut.style.transform = "translateY(" + -ta.scrollTop + "px)";
  }
  taIn.addEventListener("scroll", () => syncScroll(taIn, hlIn, gutIn));
  taOut.addEventListener("scroll", () => syncScroll(taOut, hlOut, gutOut));

  // ---------- 标签 / 统计 ----------
  function updateLabels() {
    document.querySelectorAll(".tab[data-mode]").forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("in-lang").textContent = inputLang() === "yaml" ? "YAML" : "PROPERTIES";
    const ol = outputLang();
    $("out-lang").textContent = ol === "yaml" ? "YAML" : ol === "properties" ? "PROPERTIES" : "REPORT";
    const chip = $("dir-chip");
    chip.classList.toggle("show", mode === "convert");
    if (mode === "convert") $("dir-text").textContent = dir === "y2p" ? "YAML → Properties" : "Properties → YAML";
    $("st-mode").textContent = modeText();
    taIn.placeholder = inputLang() === "yaml"
      ? "在此粘贴 YAML，或把 .yaml 文件拖进来…\nserver:\n  port: 8080\n  hosts:\n    - 10.0.0.1"
      : "在此粘贴 Properties，或把 .properties 文件拖进来…\nserver.port=8080\nserver.hosts[0]=10.0.0.1";
  }
  function updateStats() {
    $("st-in").textContent = taIn.value.length;
    $("st-out").textContent = taOut.value.length;
  }
  function renderAll() {
    renderPane(taIn, hlIn, gutIn, true);
    renderPane(taOut, hlOut, gutOut, false);
    updateStats();
  }

  // ---------- 执行 ----------
  function buildReport(r, input) {
    const top = r.value === null ? "null"
      : Array.isArray(r.value) ? "sequence"
      : typeof r.value === "object" ? "mapping"
      : typeof r.value;
    const lines = [
      "✅ 语法正确",
      "",
      "顶层类型    " + top + (top === "mapping" ? "（" + Object.keys(r.value).length + " 个顶层键）" : ""),
      "键总数      " + YamlKit.countKeys(r.value),
      "叶子值      " + YamlKit.countLeaves(r.value),
      "输入行数    " + input.split("\n").length
    ];
    if (r.warnings.length) lines.push("", "⚠️  " + r.warnings.join("；"));
    return lines.join("\n") + "\n";
  }

  function run(silent) {
    errLine = 0;
    const input = taIn.value;
    if (!input.trim()) {
      taOut.value = "";
      setStatus("wait", "等待输入", "");
      renderAll();
      return;
    }
    try {
      if (mode === "format") {
        const r = YamlKit.format(input, { indent: selIndent.value === "4" ? 4 : 2 });
        taOut.value = r.text;
        setStatus("ok", "语法正确", r.warnings.length ? r.warnings.join("；") : "已格式化");
      } else if (mode === "convert") {
        if (dir === "y2p") {
          const r = YamlKit.parse(input);
          taOut.value = YamlKit.toProps(r.value, { arrayStyle: selArr.value });
          setStatus("ok", "语法正确", r.warnings.length ? r.warnings.join("；") : "YAML → Properties 完成");
        } else {
          const obj = YamlKit.fromProps(input);
          taOut.value = YamlKit.dump(obj, { indent: selIndent.value === "4" ? 4 : 2 });
          setStatus("ok", "语法正确", "Properties → YAML 完成");
        }
      } else {
        const r = YamlKit.parse(input);
        taOut.value = buildReport(r, input);
        setStatus("ok", "语法正确", "校验通过");
      }
    } catch (e) {
      taOut.value = "";
      errLine = e && e.line ? e.line : 0;
      setStatus("err", "语法错误", (errLine ? "第 " + errLine + " 行：" : "") + (e && e.message ? e.message : String(e)));
      if (!silent) toast((errLine ? "第 " + errLine + " 行：" : "") + (e && e.message ? e.message : String(e)), true);
    }
    renderAll();
    save();
  }

  // ---------- 模式切换 ----------
  function setMode(m) {
    mode = m;
    updateLabels();
    run();
  }
  document.querySelectorAll(".tab[data-mode]").forEach((t) => {
    t.addEventListener("click", () => setMode(t.dataset.mode));
  });
  function flipDir() {
    dir = dir === "y2p" ? "p2y" : "y2p";
    updateLabels();
    run();
  }
  $("btn-dir-flip").addEventListener("click", flipDir);
  $("dir-chip").addEventListener("click", (e) => { if (e.target.id !== "btn-dir-flip") flipDir(); });

  // ---------- 辅助操作 ----------
  $("btn-sample").addEventListener("click", () => {
    taIn.value = mode === "convert" && dir === "p2y" ? SAMPLE_PROPS : SAMPLE_YAML;
    updateLabels();
    run();
    toast("已填入示例");
  });
  $("btn-clear").addEventListener("click", () => {
    taIn.value = ""; taOut.value = ""; errLine = 0;
    setStatus("wait", "等待输入", "");
    renderAll(); save();
  });
  $("btn-clear-in").addEventListener("click", () => {
    taIn.value = ""; errLine = 0;
    setStatus("wait", "等待输入", "");
    renderAll(); save();
    taIn.focus();
  });
  function exchange() {
    const t = taIn.value;
    taIn.value = taOut.value;
    taOut.value = t;
    errLine = 0;
    if (mode === "convert") dir = dir === "y2p" ? "p2y" : "y2p";
    updateLabels();
    renderAll();
    save();
  }
  $("btn-exchange").addEventListener("click", exchange);
  $("btn-swap").addEventListener("click", exchange);

  $("btn-format-now").addEventListener("click", () => setMode("format"));

  $("btn-paste").addEventListener("click", async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return toast("当前浏览器不支持剪贴板读取，请手动 Ctrl/Cmd + V 粘贴", true);
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast("剪贴板为空", true);
      taIn.value = text;
      updateLabels();
      run();
      toast("已粘贴 " + text.length + " 字符");
    } catch (e) {
      toast("浏览器未授权读取剪贴板，请手动 Ctrl/Cmd + V 粘贴", true);
    }
  });

  function copyFallback(v) {
    const ta = document.createElement("textarea");
    ta.value = v; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("已复制 " + v.length + " 字符"); }
    catch (_e) { toast("复制失败，请手动选择复制", true); }
    ta.remove();
  }
  function copyOut() {
    const v = taOut.value;
    if (!v) return toast("暂无内容可复制", true);
    if (!navigator.clipboard || !navigator.clipboard.writeText) return copyFallback(v);
    navigator.clipboard.writeText(v).then(
      () => toast("已复制 " + v.length + " 字符"),
      () => copyFallback(v)
    );
  }
  $("btn-copy-out").addEventListener("click", copyOut);

  $("btn-download").addEventListener("click", () => {
    const v = taOut.value;
    if (!v) return toast("暂无内容可导出", true);
    const ol = outputLang();
    const name = ol === "properties" ? "application.properties"
      : ol === "report" ? "validation-report.txt"
      : mode === "convert" ? "application.yaml" : "formatted.yaml";
    const blob = new Blob([v], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("已导出 " + name);
  });

  $("btn-full").addEventListener("click", () => {
    paneOut.classList.toggle("full");
  });

  // ---------- 输入 ----------
  function onInput() {
    errLine = 0;
    renderPane(taIn, hlIn, gutIn, true);
    updateStats();
    save();
    if (chkLive.checked && !lock) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lock = true;
        try { run(true); } finally { lock = false; }
      }, 300);
    }
  }
  taIn.addEventListener("input", onInput);

  selIndent.addEventListener("change", () => run());
  selArr.addEventListener("change", () => run());
  chkLive.addEventListener("change", () => { if (chkLive.checked) run(true); });

  // ---------- 拖入文件 ----------
  ["dragenter", "dragover"].forEach((ev) =>
    paneIn.addEventListener(ev, (e) => { e.preventDefault(); paneIn.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((ev) =>
    paneIn.addEventListener(ev, (e) => { e.preventDefault(); paneIn.classList.remove("dragging"); }));
  paneIn.addEventListener("drop", (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      taIn.value = String(r.result || "");
      if (/\.props|\.properties$/i.test(f.name)) { mode = "convert"; dir = "p2y"; }
      else if (/\.ya?ml$/i.test(f.name) && mode === "convert" && dir === "p2y") { mode = "format"; dir = "y2p"; }
      else if (/\.ya?ml$/i.test(f.name)) { mode = "format"; }
      updateLabels();
      run();
      toast("已载入 " + f.name);
    };
    r.readAsText(f);
  });

  // ---------- 快捷键 ----------
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    if (e.key === "Escape") {
      paneOut.classList.remove("full");
    }
  });

  // ---------- 深色切换 ----------
  $("theme-toggle").addEventListener("click", () => {
    const d = document.documentElement;
    const dark = d.dataset.theme !== "dark";
    if (dark) d.dataset.theme = "dark"; else delete d.dataset.theme;
    try { localStorage.setItem("webtools.theme", dark ? "dark" : "light"); } catch (_e) {}
  });

  // ---------- 持久化 ----------
  const LS = "webtools.yaml.v1";
  function save() { try { localStorage.setItem(LS, taIn.value); } catch (_e) {} }
  try {
    const saved = localStorage.getItem(LS);
    if (saved) taIn.value = saved;
  } catch (_e) {}

  // ---------- 启动 ----------
  updateLabels();
  setStatus("wait", "等待输入", "");
  run(true);
})();
