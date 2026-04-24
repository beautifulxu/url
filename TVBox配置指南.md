# TVBox 配置与资源站开发指南

## 一、项目背景

本项目基于 FongMi/TV（开源 Android 影音应用）的配置体系，为 TVBox 系列播放器提供资源站配置。TVBox 通过一个 JSON 配置文件来定义可用的影视资源站、解析器、直播源等。

### 相关仓库

- **FongMi/TV**: https://github.com/FongMi/TV — 主应用，支持 Android TV + 手机
- **TVBoxOSC**: https://github.com/o0HalfLife0o/TVBoxOSC/releases — TVBox 安装包发布
- **CatVodTVSpider1**: https://github.com/syzxasdc/CatVodTVSpider1 — Spider 爬虫开发项目
- **本项目配置**: https://gitee.com/wind_juvenile_admin/tv（国内）/ https://github.com/beautifulxu/url（GitHub）

---

## 二、配置文件结构

配置文件是一个 JSON，顶层字段如下：

```json
{
  "spider": "爬虫JAR包的HTTP地址（type:3时需要）",
  "sites": [],      // 点播站点列表
  "lives": [],      // 直播源列表
  "parses": [],     // VIP解析器列表
  "rules": [],      // 嗅探规则
  "flags": [],      // VIP平台标识
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
  "ext": "额外参数（type:3时使用）"
}
```

**type 字段含义：**

| type | 模式 | 数据来源 | 是否需要JAR |
|------|------|---------|------------|
| 0 | API模式（不支持搜索） | 苹果CMS标准API，返回JSON | ❌ |
| 1 | API模式（支持搜索） | 同上，TVBox会调搜索接口 | ❌ |
| 3 | Spider JAR爬虫 | JAR包中的Java类解析网页 | ✅ |
| 4 | Spider JS爬虫 | JS脚本解析网页 | 需要JS引擎 |

**playerType 字段：**
- 0: 系统播放器
- 1: IJK播放器（推荐）
- 2: Exo播放器

**优先使用 type:1**，最简单最稳定，不需要额外依赖。

### 2.2 parses 解析器

```json
{
  "name": "解析器名称",
  "type": 0,
  "url": "https://jx.example.com/?url=",
  "ext": {
    "flag": ["qq", "iqiyi", "youku"]
  }
}
```

| type | 含义 |
|------|------|
| 0 | Web嗅探（拼接URL后在WebView里嗅探） |
| 1 | JSON直接返回播放地址 |
| 3 | 内置聚合（Web/Demo） |

`ext.flag` 定义支持的平台，播放时根据flag自动匹配解析器。

### 2.3 rules 嗅探规则

```json
{
  "host": "*.example.com",
  "rule": [".m3u8", ".mp4"]
}
```

告诉WebView嗅探器在特定域名下匹配什么URL作为视频地址。通配规则用 `"host": "*"`。

### 2.4 lives 直播源

```json
{
  "name": "直播",
  "type": 0,
  "url": "http://example.com/live.txt",
  "epg": "http://epg.51zmt.top:8000/api/diyp/?ch={name}&date={date}"
}
```

支持 M3U、TXT（`#genre#` 分组）、JSON 三种格式。

---

## 三、苹果CMS API 说明

国内90%以上影视站使用苹果CMS（MacCMS）搭建，默认开放标准API。

### 3.1 判断网站是否使用苹果CMS

1. 查看网页源码，搜索 `maccms` 变量
2. URL结构特征：`/show/1-----------.html`（多横杠分隔）
3. 直接请求 `/api.php/provide/vod/`，看是否返回JSON

### 3.2 API接口

**基础地址**: `https://站点域名/api.php/provide/vod/`

| 接口 | 参数 | 说明 |
|------|------|------|
| 分类列表 | `?ac=list&pg=1` | 返回简略信息（id、名称、备注） |
| 详情列表 | `?ac=detail&pg=1` | 返回完整信息（含播放地址） |
| 按分类 | `?ac=detail&t=5&pg=1` | t=分类ID |
| 搜索 | `?ac=detail&wd=关键词` | URL编码中文 |
| 按ID | `?ac=detail&ids=12345` | 获取单个视频详情 |

**返回格式：**

```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 100,
  "total": 10000,
  "list": [
    {
      "vod_id": 12345,
      "vod_name": "影片名",
      "vod_pic": "封面图URL",
      "vod_remarks": "更新至第10集",
      "vod_play_from": "bfzym3u8",
      "vod_play_url": "第1集$https://xxx/index.m3u8#第2集$https://xxx/index.m3u8",
      "type_name": "国产剧",
      "vod_year": "2024",
      "vod_area": "大陆",
      "vod_actor": "演员",
      "vod_director": "导演",
      "vod_content": "简介"
    }
  ],
  "class": [
    {"type_id": 1, "type_name": "电影"},
    {"type_id": 2, "type_name": "连续剧"}
  ]
}
```

**播放地址格式**: `集名$URL#集名$URL`，多线路用 `$$$` 分隔 `vod_play_from` 和 `vod_play_url`。

### 3.3 新站点接入流程

```
1. 访问 https://目标站/api.php/provide/vod/
2. 如果返回JSON → 直接用 type:1，填入api地址
3. 如果返回404 → 尝试其他路径或考虑爬虫方式
4. 测试搜索: ?ac=detail&wd=测试
5. 测试播放地址: ?ac=detail&pg=1 查看 vod_play_url 是否有m3u8链接
```

---

## 四、Spider 爬虫开发（type:3）

当网站没有开放API时，需要写Spider爬虫。

### 4.1 开发环境

- 项目: https://github.com/syzxasdc/CatVodTVSpider1
- 语言: Java
- 依赖: Jsoup（HTML解析）、OkHttp（网络请求）、JSON
- 编译产物: DEX格式的JAR包

### 4.2 Spider接口

所有爬虫继承 `com.github.catvod.crawler.Spider`，需实现以下方法：

```java
public class MySite extends Spider {
    // 初始化，ext来自配置文件的ext字段
    public void init(Context context, String extend) {}

    // 首页分类 → {"class":[{"type_id":"1","type_name":"电影"}], "filters":{}}
    public String homeContent(boolean filter) {}

    // 首页推荐 → {"list":[{vod_id, vod_name, vod_pic, vod_remarks}]}
    public String homeVideoContent() {}

    // 分类列表 → {"list":[...], "page":1, "pagecount":10}
    public String categoryContent(String tid, String pg, boolean filter, HashMap<String,String> extend) {}

    // 详情页 → {"list":[{完整vod对象, vod_play_from, vod_play_url}]}
    public String detailContent(List<String> ids) {}

    // 搜索 → {"list":[...]}
    public String searchContent(String key, boolean quick) {}

    // 播放 → {"parse":0, "url":"直链", "header":{}}
    // parse=0直链播放, parse=1需要嗅探
    public String playerContent(String flag, String id, List<String> vipFlags) {}
}
```

### 4.3 常见爬虫模板

**JAR包中的通用爬虫（需要对应JAR）：**

| 类名 | 用途 | ext参数 |
|------|------|---------|
| csp_XBiu | 通用苹果CMS模板（傻瓜式） | 站点URL模板 |
| csp_XBPQ | 通用HTML解析（手动配置） | HTML选择器配置对象 |
| csp_Voflix | Voflix模板站 | 站点根地址 |
| csp_Alist | Alist网盘浏览 | 网盘地址列表 |

**XBiu 一行配置示例：**
```json
{"ext": "https://example.com/show/{cateId}--------{catePg}---.html"}
```

**XBPQ 手动配置示例：**
```json
{
  "ext": {
    "分类url": "https://example.com/show/{cateId}--------{catePg}---.html",
    "分类": "电影&电视剧&综艺&动漫",
    "分类值": "1&2&3&4",
    "数组": "<div class=\"item-pic\">&&<div class=\"item\">",
    "免嗅": "1",
    "嗅探词": ".m3u8#.mp4"
  }
}
```

### 4.4 编译流程

```bash
# 1. Gradle编译 → classes.dex
./gradlew assembleRelease

# 2. baksmali反编译
java -jar baksmali.jar d classes.dex -o Smali_classes

# 3. 放入spider.jar模板
mv Smali_classes/com/github/catvod/spider spider.jar/smali/com/github/catvod/

# 4. apktool重新打包
java -jar apktool.jar b spider.jar -c

# 5. 产物: spider.jar/dist/dex.jar → custom_spider.jar
```

### 4.5 注意事项

- 不同网站模板不同（module模板 vs ewave模板等），CSS选择器必须匹配
- 网站改版后选择器可能失效，需要重新适配
- 能用API就用API，爬虫是最后手段

---

## 五、当前可用资源站

以下API经过验证可用（截至2026年4月）：

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
# ... 更多站点
wait
```

---

## 六、配置托管

### Gitee（国内推荐）

```
https://gitee.com/wind_juvenile_admin/tv/raw/master/config.json
```

### GitHub（需代理或加速）

```
https://raw.githubusercontent.com/beautifulxu/url/main/config.json
```

加速地址: `https://ghproxy.net/https://raw.githubusercontent.com/...`

### 更新流程

```bash
# 编辑 config.json 后
cp config.json ~/TVConfig/config.json
cd ~/TVConfig
git add . && git commit -m "update config"
git push gitee main:master    # 推Gitee
git push origin main           # 推GitHub
```

---

## 七、常见问题

**Q: TVBox加载配置后没有内容？**
- 检查配置JSON格式是否正确
- type:1不需要spider字段，type:3必须有可访问的JAR地址
- 确认API地址可访问（curl测试）

**Q: 视频播放不了？**
- 可能是CDN有防盗链，换个资源站试试
- 检查播放地址是否过期（资源站会定期更换CDN域名）
- 尝试切换播放器类型（IJK/Exo/系统）

**Q: 如何判断网站是否苹果CMS？**
- 访问 `/api.php/provide/vod/`，返回JSON就是
- 网页源码搜索 `maccms` 变量
- URL含多横杠格式 `/show/1-----------.html`

**Q: 资源站域名经常变？**
- 这些采集站域名不稳定，建议定期用验证脚本检查
- 多配几个站点，一个挂了还有其他的
