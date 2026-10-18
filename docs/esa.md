# ESA 接入与内容协商

记录日期：2026-10-19。依据已采用的迁移方案与当日外部验收整理；这是手工维护摘要，未导出 ESA 控制台配置。

## 接入与回源

```text
访客 → 阿里云 DNS → ESA → GitHub Pages

主站：shijin.space
测试入口：esa-test.shijin.space
阿里云 DNS：@ CNAME → shijin.space.a1.initff.com，TTL 600 秒
权威 NS：dns1.hichina.com / dns2.hichina.com

源站地址：sj-shijin.github.io
回源协议 / 端口：HTTPS / 443
回源 Host：shijin.space
回源 SNI：sj-shijin.github.io（迁移方案采用值，未读取控制台复核）
```

GitHub Pages 继续绑定 `shijin.space`，构建和私有知识库公开清单保持原样。
ESA 边缘证书覆盖 `shijin.space`；阿里云 DNS 中保留 ESA 提供的托管 DCV 验证记录，用于续签。
源站地址始终使用 GitHub 域名，避免主站切到 ESA 后形成回源循环。

## URL 重写：当前采用方案二

仅对指定主机且接受 Markdown 的请求重写。使用已验证的扩展名排除列表；后续增加其他类型的文件时，同步更新两条规则并复验。

**规则一：路径以 `/` 结尾。**

```text
(http.host in {"esa-test.shijin.space" "shijin.space"})
and (http.request.headers["accept"] contains "text/markdown")
and (not http.request.uri.path.extension in {"md" "css" "js" "json" "txt" "xml" "svg" "png" "woff" "woff2" "ttf"})
and ends_with(http.request.uri.path, "/")

动态目标：concat(http.request.uri.path, "index.md")
```

**规则二：路径不以 `/` 结尾。**

```text
(http.host in {"esa-test.shijin.space" "shijin.space"})
and (http.request.headers["accept"] contains "text/markdown")
and (not http.request.uri.path.extension in {"md" "css" "js" "json" "txt" "xml" "svg" "png" "woff" "woff2" "ttf"})
and not ends_with(http.request.uri.path, "/")

动态目标：concat(http.request.uri.path, "/index.md")
```

两条均保留查询字符串，使用内部 URL 重写。例：`/knowledge/lattices/` 与 `/knowledge/lattices` 均映射到 `/knowledge/lattices/index.md`；普通请求继续返回 HTML。

## 缓存与响应头

相关缓存、响应头和回源规则覆盖上述两个主机；维护时核对旧单篇规则、绕过缓存规则不与全站方案叠加。

```text
缓存资格：符合缓存条件
边缘缓存 TTL：60 秒
自定义 Cachekey：保留完整请求 URL，并包含请求头 accept 的名称及其值
出站响应头：Vary: Accept-Encoding, Accept
```

`Vary` 不能替代 ESA 自定义缓存键。命中判断使用 `X-Site-Cache-Status: HIT`，并交替核对两种响应的类型与正文；源站的 `Age` 或其他命中头不能代替 ESA 证据。

## 验收与日常复查

2026-10-19 主站基线：63 种页面路径全部通过且两种表示各自命中；172 个文件在两种 Accept 下均与源站一致；11 类文件缓存样本与 6 次真实 404 检查通过。
AFDocs 0.22.2 全站复测使用 `--sampling deterministic --max-links 100`，31/31 页面支持内容协商：默认 97 分，公式差异仅报告模式 100 分。
默认结果仍保留 28/31 页的公式文本比较差异；正文和公式一致性继续由现有严格构建检查验证。

```sh
# 重复请求，观察响应类型、Vary 和两种表示各自的 ESA HIT
for accept in text/html text/markdown text/html text/markdown; do
  curl -sS --connect-timeout 5 --max-time 20 -D - -o /dev/null \
    -H "Accept: $accept" https://shijin.space/knowledge/lattices/
done

# 在网站仓库运行，分别保存默认与仅报告结果
npm run check:afdocs
```

尚未完成：ESA 未统一强制 HTTP → HTTPS；本机 16 个 ESA 地址中 6 个连接超时，其他网络可达性未确认；浏览器工具超时，未完成渲染与交互验收。
强制 HTTPS 可在 ESA 的「SSL/TLS → 边缘证书」中开启，完成后再验收并更新本记录。

## 回退

在阿里云 DNS 将现有 `@ CNAME` 恢复为 `sj-shijin.github.io`，TTL 保持 600 秒；GitHub Pages 的自定义域名保持不变。
保留 ESA 的主站记录、证书和规则，等待 DNS 缓存逐步完成回退后再处理。回退不立即覆盖所有访问。

官方参考：[URL 重写](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/rewrite-url)、[自定义缓存键](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/custom-cachekey)、[回源 SNI](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/back-to-source-sni/)、[托管 DCV](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/managed-dcv)、[强制 HTTPS](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/force-https)。
