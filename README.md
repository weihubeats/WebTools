# WebTools 🧰

纯 HTML / CSS / JS 静态小工具合集，主打 **GitHub Pages 免费托管**，无后端、无构建、无追踪。

- 首页：`index.html`
- 工具页：`tools/*.html`（每新增一个工具加一个文件即可）
- 公共样式：`assets/css/common.css`
- 工具脚本：`assets/js/*.js`

## 已有工具

| 工具 | 路径 | 功能 |
|------|------|------|
| 📦 JSON 格式化 | `tools/json-formatter.html` | 格式化 / 压缩 / 验证 + 高亮 / 树形预览 / 多段 JSON 自动分段 / 任意两段左右或上下双栏对比 / 同步滚动 / 键排序 / 转义与去转义 / 复制·下载 / localStorage 自动保存 |
| 🔣 Base64 编解码 | `tools/base64.html` | 文本 ⇄ Base64（UTF-8 安全）/ URL-safe 模式 / 实时转换 / 文件转 Base64·DataURL·图片预览 / 下载还原 |
| ⏰ 时间戳转换 | `tools/timestamp.html` | 时间戳 ⇄ 日期 / 秒毫秒自适应 / 常用时区 / ISO·UTC·本地多格式 / 实时时钟 / 今天零点快捷 |
| 🔗 URL 编解码 | `tools/url-codec.html` | encodeURI / Component 双模式 / 实时转换 / Query 表格化编辑回拼 / URL 结构拆解 |
| 🧪 正则测试 | `tools/regex.html` | 实时匹配高亮 / 分组明细 / 替换预览 / 常用模式速查 / 500 匹配防卡保护 |
| 🎫 JWT 解析 | `tools/jwt.html` | Header·Payload 解码高亮 / exp 过期判断 / Claims 解读 / alg=none 警告（仅解码不验签） |
| 📝 文本对比 | `tools/text-diff.html` | 行级 LCS diff / 增删高亮 / 忽略空白大小写 / 大文件快速模式 / diff 文本复制 |
| 🔑 密码生成器 | `tools/password.html` | crypto 加密级随机 / 无偏采样 / 长度字符集批量可调 / 每类至少含1个 / 熵值强度评估 |
| 📄 Markdown 预览 | `tools/markdown.html` | 手写零依赖解析 / 标题列表代码块表格引用 / 实时渲染 / HTML 复制导出 / localStorage 保存 |
| 🖼️ 图片压缩 | `tools/image-compress.html` | canvas 本地压缩 / 最大宽高缩放 / 质量滑杆 / JPEG·WebP·PNG 转换 / 压缩率展示 |
| 🧬 测试数据生成 | `tools/testdata.html` | UUID / 手机号 / 身份证等快捷造数 / 粘贴 Java 类或 JSON 骨架生成测试 JSON Body / 字段名启发式 / List·枚举·内部类 / 全本地 |
| 🔤 大小写 / 命名格式转换 | `tools/case.html` | camelCase · PascalCase · snake_case · CONSTANT_CASE · kebab-case · Train-Case · dot.case · path/case · Title · Sentence 等 12 种格式实时互转 / 驼峰与分隔符自动分词 / 按行对应 / 逐行·全部复制 |
| 🧾 YAML 格式化 / 转换 | `tools/yaml.html` | YAML 格式化 / 校验（行号报错）/ YAML ⇄ Properties 双向转换 / 数组风格 list[0]·list.0 可选 / 块标量·流式集合·锚点别名 / 零依赖手写解析器 |

## 本地预览

```bash
# 任意静态服务器即可，例如：
npx serve .
# 或
python3 -m http.server 8080
```

浏览器打开 http://localhost:8080/

## 部署到 GitHub Pages

1. 推送到 GitHub 仓库（分支 `main`，根目录即网站根）。
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch` → Branch 选 `main` / `root`。
3. 等 1 分钟左右访问 `https://<用户名>.github.io/<仓库名>/`。
4. 本项目已带 `.nojekyll`，防止 Pages 忽略下划线文件，原生静态直出。

## 新增工具规范

1. 在 `tools/` 下新建 `xxx.html`，引用 `../assets/css/common.css` 与 `../assets/css/nav.css`；头部放 `<div id="site-nav"></div>` + `site-nav.js`（全站导航由 `assets/js/site-nav.js` 统一渲染，工具清单也改它）。
2. JS 放 `assets/js/xxx.js`，保持零依赖。
3. 在 `index.html` 的 `.grid` 里加一张 `<a class="card">`（带 `data-cat` 归入分类 Tabs、`data-hot="1"` 上热门、`data-kw` 补搜索别名），并在导航栏对应 `.dd-menu` 里加一条入口。
4. 首页样式/逻辑在 `assets/css/home.css` 与 `assets/js/home.js`，与工具页相互独立。
5. 全本地运行，不要引入后端接口；如需 CDN 请注明可离线降级。
