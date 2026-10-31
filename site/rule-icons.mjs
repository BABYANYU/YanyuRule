import {brandIcons} from './brand-icons/map.mjs';

export const normalizeIconName=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.(png|svg|webp|jpe?g)$/,'').replace(/[^a-z0-9]/g,'');
export function catalogIconMap(catalog){
 const map=new Map();
 for(const icon of catalog?.icons||[]){
  if(typeof icon.name!=='string'||typeof icon.url!=='string'||!/^\/icons\/assets\/[a-zA-Z0-9._-]+\.(png|svg|webp|jpe?g)$/.test(icon.url))continue;
  const key=normalizeIconName(icon.name);if(key&&!map.has(key))map.set(key,icon.url);
 }
 return map;
}
const categories=[
 ['security','安全与隐私',/adguard|advertis|antivirus|privacy|hijack|marketing|password|tracker|trust|cert|pki$|^ca$|digicert|buypass|globalsign|letsencrypt|sectigo|verisign|sslcom|entrust|identrust|comodo|wisekey|twca|qianxin|captcha|geetest|vaptcha|zhiyunzhong/],
 ['game','游戏',/game|gaming|playstation|xbox|nintendo|steam|ubisoft|blizzard|battle|hoyoverse|mihoyo|riot|pubg|konami|nexon|cygames|supercell|taptap|bluearchive|projectsekai|assassin|epic|garena|mojang|lowiro|peppy|johren|purikone|warcraft|wargaming|starfield|seasun|yostar|zynga|roblox|tianCity|tgbus|gcores/i],
 ['ai','人工智能',/openai|anthropic|chatgpt|gemini|deepseek|deepmind|grok|groq|huggingface|perplexity|copilot|aixcoder|cursor|windsurf|trae|youmind|ai$/],
 ['music','音乐与音频',/music|radio|podcast|spotify|tidal|qobuz|deezer|joox|kkbox|kugou|kuwo|lizhi|ximalaya|qingting|taihe|xiami|moov|lastfm|soundcloud|pocketcasts/],
 ['media','影视与流媒体',/media|video|netflix|youtube|tv|hbo|hulu|disney|dazn|espn|douyu|huya|huashu|funshion|wasu|pptv|dandan|kanKan|ku6|youku|iqiyi|niconico|acfun|bilibili|anime|dmm|viu|tubi|viki|fubo|fox|roku|plex|emby|showtime|radiko|cabletv|migu|besttv|vidol/i],
 ['news','新闻与资讯',/news|times|post$|daily|reuters|bloomberg|economist|forbes|caixin|sankei|kyodo|nikkei|yomiuri|zaobao|guokr|ifanr|jiemian|huffpost|wsj|scmp|cnet|mainichi|manorama|barrons|kyodo|voxmedia|gannett|sina$|sohu$|36kr|jiemian/i],
 ['cloud','云服务与存储',/cloud|cdn|netdisk|drive|storage|download|wangpan|lanzou|pikpak|terabox|dubox|cowtransfer|usersdrive|wenshushu|jianguoyun|115$|chengTong|aliyun|qiniu|upyun|ctyun|dnspod|wangsu|ucloud|volcengine|synology|qnap|quickconnect|ipfs|aliyun|akamai|beget|anexia|dmit|xtom|netcup|regRu|timeweb|selectel/i],
 ['social','社交与通信',/social|chat|telegram|whatsapp|wechat|weibo|twitter|facebook|discord|communication|voip|clubhouse|blued|renren|fanfou|tieba|tianya|douban|xiaohongshu|okjike|momo|qq$|zhihu|juejin|linuxdo|nodeseek|nga$|stage1st|jianShu|coolapk|hupu/i],
 ['mail','邮件',/mail|mxroute|tempMail|outlook|gmail/i],
 ['finance','金融与支付',/bank|pay|coin|crypto|finance|fintech|invest|schwab|ibkr|mastercard|visa|hsbc|unionpay|eastmoney|xueqiu|pingan|longbridge|kucoin|kraken|bit|okx|gateio|deribit|moomoo|straitsx|icbc|ccb$|boc$|bocom|cmb$|cgb$|psbc|pstorage|tiger|nexo|raiffeisen|standardchartered|wise$|^n26$/i],
 ['shopping','购物与生活',/shop|store|commerce|buy|mall|market|coupon|pinduoduo|jingdong|dangdang|suning|meituan|eleme|xianyu|vipshop|zhuanzhuan|shopee|coupang|ozon|walmart|wholefoods|costco|ruten|mvideo|wildberries|bestbuy|farfetch|target|nordstrom|wish$|vancl|dewu|taobao|muji|ikea|miniso|luckin|starbucks|mcdonald|familymart/i],
 ['education','学习与学术',/edu|school|scholar|learn|study|academy|book|novel|font|type|science|springer|elsevier|clarivate|ieee|embl|proquest|pearson|oup$|wanfang|cnki|cnki|cas$|mit$|hku|hkbu|hkust|cuhk|polyu|edx|udacity|udemy|duolingo|guokr|dedao|shanbay|zuoyebang|17zuoye|yuanfudao|xueersi|youdao|koolearn|hujiang|yuketang|zhangyue|shijichaoxing/i],
 ['developer','软件与开发',/dev|code|program|linux|git|docker|container|kubernetes|npm|python|perl$|ruby|rust$|scala|golang|haskell|dart$|swift$|qt$|jsdelivr|staticfile|bootcss|polymer|openjs|mozilla|opera|browser|android|software|oschina|termux|fastlane|homebrew|jetbrains|api|remote|teamviewer|anydesk|cyber|redis|mongo|nginx|debian|fedora|ubuntu|deepin|archlinux|kernel|source|^go$|^tex$/],
 ['travel','出行与物流',/airline|airchina|aviasales|booking|travel|express|post$|12306|didi|uber|deppon|kuaidi|cdek|cainiao|chengcheng|xiecheng|tongcheng|mafengwo|fcbox|whoosh|map|naver|gaode|qweather|weather|windy|gismeteo/],
 ['network','网络服务',/dns|doh|ntp|stun|lan$|direct|proxy|global|china|ip$|ips$|asn|connect|speedtest|broadnet|telecom|unicom|mobile|hinet|hkbn|hurricane|smarTone|softbank|verizon|att$|pccw|cht$|hkt|ddns|node|wifi/i],
];
const classifiedNames={
 game:'17173 178 4399 ACG Akiko Asobo Bethesda BianFeng Bohemia Bushiroad ChangYou ChunYou CowLevel DuoWan EscapeFromTarkov FengXiaWangLuo Forza Gaijin GGSel JiyuKobo NGAA Rockstar SMTiaoJiaoShi SNK TakeTwo Taomee VGTime VikACG VisualArts WanKaHuanJu WanMeiShiJie WildRift XiaoHeihe Yostar',
 media:'56 6JianFang ABC AFP AlJazeera AP Asahi Bangumi BaoFengYingYin BBC BrightCove CIBN CSPAN CWSeed DiscoveryPlus Dood FengXing FZDM Globo Hpplay ICable IINA InShot Japonx Jwplayer Marvel MeWatch NBCUniversal NHK Pawchive Phoenix Polyv Rarbg RTHK SkyGO Sling StarPlus StarWorld Streamable SVP UOLiv YNet YiZhiBo YY YYeTs Zee',
 news:'Pugpig 9to5 AnandTech BJYouth BoXun DowJones FT IDG Insider LondonReal TheGuardian TheSun TokyoSports',
 security:'360 Actalis AnTianKeJi BaiFenDian CEB Clearasil ComssOne DingDaTech Domob ESET Faronics Getui IShuMei JiGuang KuangShi OneKey SafePal ShangHaiJuXiao ShareThis ShiNongZhiKe SwissSign TianWeiChengXin Zscaler',
 cloud:'800Best AnnasArchive ArchiveToday BaiShanYunKeJi CasImages DiLianWangLuo DuyaoSS Dynu FangZhengDianZi Gandi GMOInternet ImageBam ImageCurl ImageShack ImageTwist ImgBB Imgix Limelight NICru Picsee PixHost PostImages Quantil Scaleflex ServicePipe Xunlei YunFanJiaSu',
 education:'Arphic BetterExplained Brilliant BuBeiDanCi Chegg CityUHK DianCeWangKe FangZhengDianZi Glyphs HanYi HKedcity IHuman ImperialCollege JinJiangWenXue Laracasts LibGen Linguee MasterClass Morisawa MZed Schoopia SCI SciHub TaylorFrancis TheType TranslateWiki Typography U17 WebArchive WikiCN WikiDot WikiHow XiaoYuanKeJi YuanBei ZhiYinManKe',
 music:'TencentTME Fiio HibyMusic Musixmatch Shanling XiaoYuZhou',
 social:'Blurams CnBlogs Discuz DuiTang Feishu FlowUs InoReader iTalkBB Likee LivePerson MingLueZhaoHui Moonvy Pixnet SegmentFault SuiShiChuanMei WenJuanXing XDA YouMengChuangXiang',
 finance:'8btc AiQiCha CITIC CKJR Everbright IFast QCC QiXin TaiKang ZB',
 shopping:'51Job Aerogard AirWick Anjuke Bridgestone CalgonCarbon Dettol DingDong DingXiangYuan DongCheDi Durex Eneba Enfa FeiZhu Finish Flowwow Geely Gucci HeMa HomeDepot JuShuiTan Kindle KingSmith KouDaiShiShang LeJu Lianjia LiePin LouisVuitton Lysol Magnit MeadJohnson MeiTu Mogujie Mortein MoveFree Mucinex Nurofen PChomeTW RB SouFang Strepsils SumKoo SurugaYa Technogym Vanish Veet WeiZhiYunDong Woolite X5 YiXiaKeJi YouZan ZhongGuoShiHua ZhongYuanYiShang ZhuBaJie Ziroom',
 developer:'Anker Apkpure Beisen Camera360 Canon ChuangKeTie CNB CNNIC Coding Collabora Corel DiSiFanShi Dwion Emojipedia FastStone Gettyimages Gigabyte GovCN Gracg GuiGuDongLi Haier Hikvision iFlytek IntSig IXsystems JiBenCaoZuo JLC KeChuang Keep Kingsoft Lighter LinakeSi LuDaShi Lumion LvMiLianChuang Madshi MeiZu MetaBrainz Midea MiWu Narwal Neowin OKAApps OuPeng Pgyer PlayCover RuanMei ShenMa Spiceworks Startpage Tailscale TCL Tidelift Tonec UC Umeng URLShortener Vivo Wallhaven WangXinKeJi WeiPhone XEdge XiaoGouKeJi Yandex YnoProject Yokaverse Zeplin ZhongWeiShiJi ZTE',
};
const specificCategories=new Map(Object.entries(classifiedNames).flatMap(([category,names])=>names.split(' ').filter(Boolean).map(name=>[normalizeIconName(name),category])));
export function iconForRule(rule,catalog=new Map()){
 const name=normalizeIconName(rule?.name),slug=Object.hasOwn(brandIcons,name)?brandIcons[name]:null;
 if(slug)return {url:'/brand-icons/'+slug+'.svg',kind:'brand',label:rule.name};
 if(catalog.has(name))return {url:catalog.get(name),kind:'catalog',label:rule.name};
 const specific=specificCategories.get(name),category=specific?categories.find(([id])=>id===specific):categories.find(([, ,pattern])=>pattern.test(name));
 return {url:'/rule-icons/'+(category?.[0]||'rules')+'.svg',kind:category?'category':'fallback',label:category?.[1]||'规则集合'};
}
export const fallbackRuleIcon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#40454d" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h15l9 9v29H13zM28 5v10h9M20 24h10M20 31h10M20 38h6"/></svg>');
