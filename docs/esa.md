# ESA 接入与内容协商

配置与验收基线：2026-10-19。本文是方案及当日外部验收的手工摘要，控制台配置与当前可达性需现场复核。

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
回源 SNI：sj-shijin.github.io（方案值，控制台待复核）
```

GitHub Pages 绑定 `shijin.space`，ESA 以 GitHub 域名作为固定源站，保持单向回源。ESA 边缘证书覆盖主站，阿里云 DNS 保留托管 DCV 记录供续签。

## URL 重写

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

缓存、响应头和回源规则统一覆盖上述两个主机；维护时整合旧单篇规则与绕过缓存规则，保持生效规则一致。

```text
缓存资格：符合缓存条件
边缘缓存 TTL：60 秒
自定义 Cachekey：保留完整请求 URL，并包含请求头 accept 的名称及其值
出站响应头：Vary: Accept-Encoding, Accept
```

缓存区分响应类型：ESA 缓存键包含 `Accept`，`Vary` 告知下游按请求头区分响应。使用 `X-Site-Cache-Status: HIT` 验证 ESA 命中，并交替核对 HTML、Markdown 的响应类型与正文。

## 验收与日常复查

2026-10-19 主站基线：63 种页面路径全部通过且两种表示各自命中；172 个文件在两种 Accept 下均与源站一致；11 类文件缓存样本与 6 次真实 404 检查通过。
AFDocs 0.22.2 全站复测使用 `--sampling deterministic --max-links 100`，31/31 页面支持内容协商：默认 97 分，公式差异仅报告模式 100 分。
默认结果包含 28/31 页的公式文本比较差异；当前构建检查与 AFDocs 结果解读见 [README](../README.md#构建与-ai-读取)。

```sh
# 重复请求，观察响应类型、Vary 和两种表示各自的 ESA HIT
for accept in text/html text/markdown text/html text/markdown; do
  curl -sS --connect-timeout 5 --max-time 20 -D - -o /dev/null \
    -H "Accept: $accept" https://shijin.space/knowledge/lattices/
done

# 在网站仓库运行，分别保存默认与仅报告结果
npm run check:afdocs
```

该次验收的待复核项：HTTP → HTTPS 强制跳转、跨网络可达性、浏览器渲染与交互。当时本机 16 个 ESA 地址中 6 个连接超时，浏览器工具也超时。HTTPS 设置位于 ESA「SSL/TLS → 边缘证书」，实际完成复验后更新本记录。

## 回退

在阿里云 DNS 将现有 `@ CNAME` 恢复为 `sj-shijin.github.io`，TTL 保持 600 秒；GitHub Pages 的自定义域名保持不变。
保留 ESA 的主站记录、证书和规则，等待 DNS 缓存逐步完成回退后再处理。

官方参考：[URL 重写](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/rewrite-url)、[自定义缓存键](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/custom-cachekey)、[回源 SNI](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/back-to-source-sni/)、[托管 DCV](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/managed-dcv)、[强制 HTTPS](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/force-https)。
