# TVBox 配置与资源站开发指南

## 一、项目背景

本项目基于 FongMi/TV（开源 Android 影音应用）的配置体系，为 TVBox 系列播放器提供资源站配置。TVBox 通过一个 JSON 配置文件来定义可用的影视资源站、解析器、直播源等。

### 相关仓库

- **FongMi/TV**: https://github.com/FongMi/TV — 主应用（Android TV + 手机），4个模块：app/catvod/quickjs/chaquo
- **TVBoxOSC**: https://github.com/o0HalfLife0o/TVBoxOSC/releases — TVBox 安装包发布（推荐 takagen99 版，arm64-generic-java.apk）
- **CatVodTVSpider1**: https://github.com/syzxasdc/CatVodTVSpider1 — Spider 爬虫开发调试项目（已 clone 到 ~/CatVodTVSpider1）
- **qist/tvbox**: https://github.com/qist/tvbox — 完整配置参考（~90个站点，含 spider.jar + js + py 爬虫）
- **本项目配置**: https://gitee.com/wind_juvenile_admin/tv（国内）/ https://github.com/beautifulxu/url（GitHub）
- **本地配置仓库**: ~/TVConfig

### FongMi/TV 架构概览

```
TV/
├── app/            主应用（leanback电视版 + mobile手机版）
│   ├── src/main/   共用业务逻辑
│   │   ├── api/config/   配置层（VodConfig/LiveConfig/WallConfig/RuleConfig）
│   │   ├── api/loader/   爬虫加载器（BaseLoader → JarLoader/JsLoader/PyLoader）
│   │   ├── bean/         35个数据类（Vod/Site/Channel/Episode/Flag等）
│   │   ├── db/           Room数据库（v35，7个实体）
│   │   ├── player/       播放器（ExoPlayer/Media3 + 弹幕 + 字幕）
│   │   ├── model/        ViewModel（SiteViewModel/LiveViewModel）
│   │   ├── server/       本地HTTP服务（NanoHTTPD，端口9978-9998）
│   │   └── event/        EventBus事件
│   ├── src/leanback/     电视版UI（12 Activity + Presenter模式）
│   └── src/mobile/       手机版UI（9 Activity + ViewHolder模式）
├── catvod/         爬虫抽象层（Spider接口 + OkHttp网络栈）
├── quickjs/        QuickJS JavaScript引擎
└── chaquo/         Chaquopy Python引擎
```

技术栈：Java 17, AGP 9.1.1, ExoPlayer (Media3 1.10.0), OkHttp 5.3.2, Glide 5.0.5, Room 2.8.4, EventBus

---

## 二、配置文件结构

```json
{
  "spider": "爬虫JAR包的HTTP地址（type:3时需要）",
  "sites": [],      // 点播站点列表
  "lives": [],      // 直播源列表
  "parses": [],     // VIP解析器列表
  "rules": [],      // 嗅探规则
  "flags": [],      // VIP平台标识
  "doh": [],        // DNS over HTTPS（可选）
  "ijk": [],        // IJK播放器参数（可选）
  "ads": [],        // 广告拦截域名（可选）
  "wallpaper": ""   // 壁纸API（可选）
}
```

### 2.1 sites 站点配置

```json
{
  "key": "唯一标识",
  "name": "显示名称",
  "type": 1,
  "api": "API地址",
  "searchable": 1,
  "quickSearch": 1,
  "filterable": 1,
  "playerType": 1,
  "ext": "额外参数（type:3时使用）",
  "jar": "单独指定JAR地址（可选）",
  "timeout": 60,
  "style": {"type": "rect", "ratio": 1.597},
  "changeable": 1
}
```

**type 字段含义：**

| type | 模式 | 数据来源 | 是否需要JAR |
|------|------|---------|------------|
| 0 | API模式（不支持搜索） | 苹果CMS标准API，返回JSON | ❌ |
| 1 | API模式（支持搜索） | 同上，TVBox会调搜索接口 | ❌ |
| 3 | Spider爬虫 | JAR/JS/PY中的爬虫代码 | ✅（或JS/PY） |
| 4 | Spider JS爬虫（旧版） | JS脚本解析网页 | 需要JS引擎 |

**playerType**: 0=系统播放器, 1=IJK播放器（推荐）, 2=Exo播放器

**优先使用 type:1**，最简单最稳定，不需要额外依赖。

### 2.2 parses 解析器

```json
{
  "name": "解析器名称",
  "type": 0,
  "url": "https://jx.example.com/?url=",
  "ext": {
    "flag": ["qq", "iqiyi", "youku"],
    "header": {"user-agent": "..."}
  }
}
```

| type | 含义 |
|------|------|
| 0 | Web嗅探（拼接URL后在WebView里嗅探） |
| 1 | JSON直接返回播放地址 |
| 3 | 内置聚合（Web/Demo） |

### 2.3 rules 嗅探规则

```json
{"host": "zmcdy.com", "rule": [".m3u8", ".mp4"]}
```

高级用法（含脚本注入）：
```json
{"name": "点击播放", "hosts": ["example.com"], "script": ["document.querySelector('#play').click();"]}
```

### 2.4 lives 直播源

```json
{"name": "直播", "type": 0, "url": "http://example.com/live.txt", "epg": "http://epg.51zmt.top:8000/api/diyp/?ch={name}&date={date}"}
```

### 2.5 doh / ijk / ads（高级配置）

```json
"doh": [{"name": "Google", "url": "https://dns.google/dns-query", "ips": ["8.8.8.8"]}],
"ads": ["static-mozai.4gtv.tv"]
```

---

## 三、苹果CMS API 说明

国内90%以上影视站使用苹果CMS（MacCMS）搭建，默认开放标准API。

### 3.1 判断方法

1. 网页源码搜索 `var maccms` 变量
2. URL特征：`/show/1-----------.html`（多横杠分隔）
3. 直接请求 `/api.php/provide/vod/`，返回JSON即是
4. 搜索API：`/index.php/ajax/suggest?mid=1&wd=关键词&limit=20`

### 3.2 API接口

**基础地址**: `https://站点域名/api.php/provide/vod/`

| 接口 | 参数 | 说明 |
|------|------|------|
| 分类列表 | `?ac=list&pg=1` | 简略信息 |
| 详情列表 | `?ac=detail&pg=1` | 完整信息（含播放地址） |
| 按分类 | `?ac=detail&t=5&pg=1` | t=分类ID |
| 搜索 | `?ac=detail&wd=关键词` | URL编码中文 |
| 按ID | `?ac=detail&ids=12345` | 单个视频详情 |

**播放地址格式**: `集名$URL#集名$URL`，多线路用 `$$$` 分隔。

### 3.3 新站点接入流程

```
1. 访问 https://目标站/api.php/provide/vod/
2. 返回JSON → type:1，填入api地址
3. 返回404 → 尝试 /api.php/provide/vod/?ac=list 或其他路径
4. 都不行 → 考虑爬虫方式（type:3）
5. 测试搜索: ?ac=detail&wd=测试
6. 测试播放: ?ac=detail&pg=1 查看 vod_play_url 是否有m3u8链接
```

### 3.4 踩坑记录

- zmcdy.com 用的是 `ewave` 模板（不是 `module` 模板），Voflix Spider 的 CSS 选择器匹配不上
- 但它开放了苹果CMS API，所以直接用 type:1 就行
- 教训：**先试 API，再考虑爬虫**

---

## 四、Spider 爬虫开发（type:3）

### 4.1 三种爬虫引擎

#### Java JAR（编译型）

- 开发项目: https://github.com/syzxasdc/CatVodTVSpider1（已clone到 ~/CatVodTVSpider1）
- 源码位置: `app/src/main/java/com/github/catvod/spider/`
- 典型示例: SP360.java（API调用型）、Voflix.java（Jsoup HTML解析型）
- 编译产物: DEX格式JAR包

Spider 基类接口：
```java
public abstract class Spider {
    public void init(Context context, String extend) {}
    public String homeContent(boolean filter) {}        // 首页分类
    public String homeVideoContent() {}                  // 首页推荐
    public String categoryContent(String tid, String pg, boolean filter, HashMap<String,String> extend) {}
    public String detailContent(List<String> ids) {}     // 详情
    public String searchContent(String key, boolean quick) {}
    public String playerContent(String flag, String id, List<String> vipFlags) {}
    public boolean manualVideoCheck() {}
    public boolean isVideoFormat(String url) {}
}
```

编译流程（Mac需手动操作，原脚本是Windows bat）：
```
Gradle编译 → classes.dex → baksmali反编译 → smali放入spider.jar模板 → apktool打包
```

#### JS 爬虫 / DRPY（声明式）

DRPY 是 JS 爬虫框架，用声明式规则描述爬取逻辑：

```javascript
var rule = {
    title: '腾讯视频',
    host: 'https://v.qq.com',
    url: '/x/bu/pagesheet/list?channel=fyclass&offset=((fypage-1)*21)',
    searchUrl: '**',
    class_name: '电影&电视剧',
    class_url: 'movie&tv',
    一级: 'json:data.list;title;cover;updateInfo;cid',   // 数据提取规则
    二级: $js.toString(() => { /* 详情页逻辑 */ }),
    lazy: $js.toString(() => { /* 播放地址解析 */ }),
    filter: { /* 筛选配置 */ }
}
```

- `fyclass`/`fypage` 是占位符，引擎自动替换
- `一级` 用 `json:` 路径或 CSS 选择器
- 配置中：`"api": "./js/drpy2.min.js"`, `"ext": "./js/腾讯视频.js"`

#### Python 爬虫

用于 APP 逆向等复杂场景，需要 TVBox Python 版 APK。

```python
class Spider(Spider):
    def init(self, extend=""): pass
    def homeContent(self, filter): pass
    def categoryContent(self, tid, pg, filter, extend): pass
    def detailContent(self, ids): pass
    def searchContent(self, key, quick, pg="1"): pass
    def playerContent(self, flag, id, vipFlags): pass
```

典型模式（如金牌影视）：逆向APP → 找到API → 破解签名算法（MD5+SHA1）→ 模拟请求

### 4.2 通用爬虫模板

| 类名 | 用途 | ext参数 |
|------|------|---------|
| csp_XBiu | 通用苹果CMS（傻瓜式） | URL模板 `https://site.com/show/{cateId}--------{catePg}---.html` |
| csp_XBPQ | 通用HTML解析（手动配置） | HTML选择器配置对象（`&&`截取语法） |
| csp_Voflix | Voflix模板站 | 站点根地址（注意：只适配module模板，不适配ewave模板） |
| csp_AppDrama | 通用APP逆向 | RSA/AES密钥 + 配置文件地址（一个类适配多个APP） |
| csp_AppGet | 通用加密APP | AES密钥 + API地址 |
| csp_AppYsV2 | 通用影视APP API | API地址 |
| csp_PanWebShare | 网盘分享站聚合 | 多个站点地址 |
| csp_Bili | 哔哩哔哩 | JSON配置 + cookie |
| csp_Alist | Alist网盘 | 网盘地址列表 |

### 4.3 XBPQ `&&` 截取语法

```
"开始标记&&结束标记"
```
从HTML中找到"开始标记"，截取到"结束标记"之间的内容。

关键字段：分类url、分类、分类值、数组、副标题、线路数组、线路标题、播放数组、免嗅、嗅探词、过滤词、类型、地区、年份、排序、筛选

---

## 五、当前可用资源站

以下API经过验证可用（截至2026年4月24日）：

| 站点 | API地址 | 资源量 | 分类数 |
|------|---------|--------|--------|
| 暴风资源 | https://bfzyapi.com/api.php/provide/vod/ | 141,389 | 48 |
| 量子资源 | https://cj.lziapi.com/api.php/provide/vod/ | 132,587 | 43 |
| 闪电资源 | https://sdzyapi.com/api.php/provide/vod/ | 116,681 | 59 |
| 无尽资源 | https://api.wujinapi.com/api.php/provide/vod/ | 109,631 | 63 |
| 光速资源 | https://api.guangsuapi.com/api.php/provide/vod/ | 102,540 | 28 |
| 速播资源 | https://subocaiji.com/api.php/provide/vod/ | 102,338 | 31 |
| 新浪资源 | https://api.xinlangapi.com/xinlangapi.php/provide/vod/ | 102,348 | 28 |
| 红牛资源 | https://www.hongniuzy2.com/api.php/provide/vod/ | 101,938 | 28 |
| 豪华资源 | https://hhzyapi.com/api.php/provide/vod/ | 101,266 | 39 |
| 非凡资源 | https://cj.ffzyapi.com/api.php/provide/vod/ | 95,705 | 31 |
| 卧龙资源 | https://collect.wolongzy.cc/api.php/provide/vod/ | 86,281 | 40 |
| 神马电影 | https://zmcdy.com/api.php/provide/vod/ | 79,329 | 33 |
| 百度云资源 | https://api.apibdzy.com/api.php/provide/vod/ | 46,533 | 54 |

验证失败的站点（2026年4月）：天空、OK、鱼乐、快车、酷云、淘片、飞速、鲸鱼、鹰眼、鼎力、海螺

### 批量验证脚本

```bash
#!/bin/bash
test_api() {
  local name="$1" url="$2"
  local result=$(curl -s --max-time 8 "${url}?ac=list&pg=1" 2>/dev/null)
  local info=$(echo "$result" | python3 -c "
import sys,json;d=json.load(sys.stdin)
print(f'{d[\"total\"]}条 {len(d.get(\"class\",[]))}类')" 2>/dev/null)
  [ -n "$info" ] && echo "✅ $name: $info" || echo "❌ $name"
}
test_api "站点名" "https://api地址/" &
wait
```

### 速度测试说明

- curl 直接测 m3u8/ts 下载速度不准确，因为很多CDN有防盗链（Referer检查）
- 最可靠的测试方式是在 TVBox 里直接点播视频看加载速度
- 测试脚本见项目中的 test_speed2.sh / test_speed3.sh

---

## 六、参考配置（qist/tvbox）

https://github.com/qist/tvbox 提供了一个约90个站点的完整配置，结构：

```
xiaosa/
├── spider.jar      ← 2MB，Java爬虫（csp_AppDrama/csp_AppGet/csp_PanWebShare等）
├── js/             ← 80+ JS爬虫（腾讯/优酷/芒果/爱奇艺/瓜子影视等）
│   └── drpy2.min.js  ← DRPY JS引擎
├── py/             ← 24个Python爬虫（金牌影视/网络直播/爱听音乐等）
├── XBPQ/           ← XBPQ模板配置
├── XYQHiker/       ← 海阔视界规则
├── json/           ← 哔哩合集/教育课堂配置
└── api.json        ← 主配置文件
```

站点分类：APP逆向、4K网盘聚合、视频平台、磁力资源、网盘浏览、聚合搜索、短剧、体育、音乐、教育

配置地址：`https://raw.githubusercontent.com/qist/tvbox/master/xiaosa/api.json`

注意：使用此配置需要 Python 版 TVBox APK（文件名带 python），否则 py 爬虫站点不可用。

---

## 七、配置托管与更新

### Gitee（国内推荐）

```
https://gitee.com/wind_juvenile_admin/tv/raw/master/config.json
```

### GitHub

```
https://raw.githubusercontent.com/beautifulxu/url/main/config.json
```
加速：`https://ghproxy.net/https://raw.githubusercontent.com/...`

### 更新流程

```bash
# 编辑 config.json 后
cp config.json ~/TVConfig/config.json
git -C ~/TVConfig add .
git -C ~/TVConfig commit -m "update config"
git -C ~/TVConfig push gitee main:master    # 推Gitee
git -C ~/TVConfig push origin main           # 推GitHub
```

### Git SSH 配置

SSH key 位于 `~/.ssh/id_rsa`（注册给 coding.net，已添加到 GitHub 和 Gitee）。
如果 SSH agent 没加载 key，执行：`ssh-add ~/.ssh/id_rsa`

---

## 八、常见问题

**Q: TVBox加载配置后没有内容？**
- type:1 不需要 spider 字段，type:3 必须有可访问的 JAR 地址
- 确认 API 地址可访问（curl测试）
- 检查 JSON 格式（不能有注释、尾逗号）

**Q: 视频播放不了？**
- CDN 防盗链 → 换资源站
- 播放地址过期 → 资源站会定期更换CDN域名
- 切换播放器类型（IJK/Exo/系统）

**Q: 如何判断网站是否苹果CMS？**
- 访问 `/api.php/provide/vod/`
- 网页源码搜索 `maccms`
- URL含多横杠 `/show/1-----------.html`

**Q: XBiu/XBPQ 解析不出来？**
- 检查网站用的是什么模板（module vs ewave vs 其他）
- XBiu 只适配常见CMS模板，冷门模板需要 XBPQ 手动配置选择器
- 最好先试 API 模式

**Q: 资源站域名经常变？**
- 采集站域名不稳定，定期用验证脚本检查
- 多配几个站点做冗余

**Q: 国内访问不了 GitHub？**
- 配置地址用 Gitee
- JAR/JS 等资源用 ghproxy.net 加速
- 或者把所有文件都推到 Gitee

---

## 九、环境备忘

- macOS, zsh, oh-my-zsh (agnoster主题)
- 代理：Clash 端口 7890，已配置 ~/.zshrc 自动检测（proxy_auto函数）
- 快捷命令：proxy_on / proxy_off / proxy_status
- Git 走代理需要 export http_proxy/https_proxy，或用 SSH 方式推送
