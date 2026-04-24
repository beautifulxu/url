const HOST = 'https://v.koolearn.com';
const APP = 'http://cmsapp.koolearn.com/gongkaike.php';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: `${HOST}/`,
};

const CLASSES = [
  ['2188', '出国留学'],
  ['2189', '研究生'],
  ['2190', '大学'],
  ['2191', '中小学'],
  ['2192', '小语种'],
  ['2193', '职业教育'],
  ['2194', '医学'],
  ['2195', '综合英语'],
  ['2196', '口语大赛'],
  ['3839', '百学汇'],
  ['4644', '扫黄打非公益展播'],
  ['4645', '短视频'],
];

function request(url) {
  const res = globalThis._http(url, { headers: HEADERS, timeout: 15000 });
  return res && res.content ? res.content : '';
}

function text(value) {
  return (value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, name) {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, 'i');
  const match = html.match(pattern);
  return match ? match[1].replace(/\\\//g, '/') : '';
}

function abs(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${HOST}${url}`;
  return url.replace(/^https?:\/\/v\.koolearn\.com/i, HOST);
}

function parseJsonpHtml(content) {
  const start = content.indexOf('(');
  const end = content.lastIndexOf(')');
  if (start < 0 || end <= start) return '';
  try {
    return JSON.parse(content.slice(start + 1, end));
  } catch (e) {
    return '';
  }
}

function parseList(html) {
  const list = [];
  const blocks = html.match(/<dl[\s\S]*?<\/dl>/g) || [];
  for (const block of blocks) {
    const vodId = abs(attr(block, 'href'));
    const vodName = text(attr(block, 'title')) || text((block.match(/<dd title=["'][^"']*["'][^>]*>([\s\S]*?)<\/dd>/i) || [])[1]);
    const vodPic = abs(attr(block, 'src'));
    const remarks = text((block.match(/<dd class=["']dd3["'][^>]*>\s*<p>([\s\S]*?)<\/p>/i) || [])[1]);
    if (!vodId || !vodName || !/\/\d+\.html$/.test(vodId)) continue;
    list.push({
      vod_id: vodId,
      vod_name: vodName,
      vod_pic: vodPic,
      vod_remarks: remarks,
    });
  }
  return list;
}

function parsePageCount(html) {
  const match = html.match(/id=["']list_total_page_num["']\s+value=["'](\d+)["']/i);
  return match ? Number(match[1]) : 1;
}

function categoryUrl(tid) {
  return `${HOST}/c/${tid}-2.html`;
}

const spider = {
  init() {},

  home() {
    return JSON.stringify({
      class: CLASSES.map(([type_id, type_name]) => ({ type_id, type_name })),
    });
  },

  homeVod() {
    return this.category('2195', '1');
  },

  category(tid, pg) {
    const page = Number(pg || 1);
    let html;
    let pagecount = 999;
    if (page <= 1) {
      html = request(categoryUrl(tid));
      pagecount = parsePageCount(html);
    } else {
      const jsonp = request(`${APP}?a=catlist_page&catid=${encodeURIComponent(tid)}&ord=2&page_num=${page - 1}&callback=cb`);
      html = parseJsonpHtml(jsonp);
    }
    return JSON.stringify({
      page,
      pagecount,
      limit: 28,
      total: pagecount * 28,
      list: parseList(html),
    });
  },

  detail(id) {
    const html = request(abs(id));
    const name = text((html.match(/<p class=["']yp1["'][^>]*title=["']([^"']+)["']/i) || [])[1])
      || text((html.match(/<title>([\s\S]*?)-新东方在线网络课堂<\/title>/i) || [])[1]);
    const pic = abs(attr((html.match(/<div[^>]+name=["']video_creat["'][^>]*>/i) || [])[0] || '', 'img_src'));
    const mp4 = abs(attr((html.match(/<div[^>]+name=["']video_creat["'][^>]*>/i) || [])[0] || '', 'dir_mp4'));
    const desc = text((html.match(/视频简介：([\s\S]*?)<\/p>/i) || [])[1]);
    return JSON.stringify({
      list: [{
        vod_id: abs(id),
        vod_name: name,
        vod_pic: pic,
        vod_content: desc,
        vod_play_from: '新东方',
        vod_play_url: mp4 ? `播放$${mp4}` : '',
      }],
    });
  },

  search() {
    return JSON.stringify({ list: [] });
  },

  play(flag, id) {
    return JSON.stringify({
      parse: 0,
      url: abs(id),
      header: HEADERS,
    });
  },

  live() {
    return '';
  },

  sniffer() {
    return false;
  },

  isVideo(url) {
    return /\.(mp4|m3u8)(\?|$)/i.test(url);
  },

  proxy() {
    return [404, 'text/plain', ''];
  },

  action() {
    return '';
  },

  destroy() {},
};

export default spider;
