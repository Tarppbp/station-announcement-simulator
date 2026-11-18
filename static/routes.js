'use strict';
/* 内置线路定义（原声页 original.js 和改编页 app.js 共用）。
   每条线路对应 data/<pid>/ 里的一段原声样本；改编页可在这段原声上替换已定位的名称。 */
const row = (name, ja = '', en = '', no = '', tja = '', ten = '') => ({name, ja, en, no, tja, ten});

/* =====================================================================
   线路定义
   线路有原声时可以试听及替换已定位的名称。
   ===================================================================== */
const JR = (key, pid, name, code, color, direction, stations, note, extra = {}) => ({
 key, city: '东京', kind: '铁路', name, code, color, pid, ja: true, en: true, line: name, direction, stations, note, ...extra});
const CR = (key, pid, name, code, station, english, stationLabel, sub, note, serial) => ({
 key, pid, name, code, stationLabel, sub, note,
 city: '国铁', kind: '高铁', color: '#c8102e', en: true, line: name,
 stations: [row(station)], stationEnglish: {[station]: english},
 sourceUrl: 'https://www.jprailfan.com/announce/downconfirm.php?serial=' + serial
});
const routes = [
 {key: 'bus510', city: '上海', kind: '公交', name: '公交 510 路', code: '510', color: '#e77736', pid: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', en: true,
  line: '510路', terminal: '武威东路真金路', direction: '武威东路真金路方向', sub: '普通话 · 沪语 · 英语',
  stations: [row('公平路东长治路', '', 'Gongping Road at Dongchangzhi Road'), row('巴黎', 'パリ', 'Paris')],
  note: '普通话、沪语、英语原声。线路名、终点站、下一站会用语音生成替换，其余保留原声；沪语里的新名称暂用普通话。'},
 CR('crG3106', 'e521e8a6e66d880504ea0b20bae44ab8', '国铁 G3106 · 南京南', 'G3106',
  '南京南', 'Nanjing Nan', '即将到站', '到站预告 · 中英',
  '2022 年车内实录。可改中英文站名，保留行李和下车提示。', '2134'),
 CR('crG5602', 'f527a0650e23c6ed1aec3603b69b215c', '国铁 G5602 · 福田', 'G5602',
  '福田', 'Futian', '到站', '到站广播 · 中英',
  '2025 年车内实录的普通话和英文片段。可改站名，保留脚下安全提示。', '2820'),

 JR('yamanote', 'ffffffffffffffffffffffffffffffff', '山手線', 'JY', '#9acd32', '品川・渋谷方面',
  [row('目黒', 'めぐろ', 'Meguro', 'JY 22', '東急目黒線、地下鉄南北線、都営地下鉄三田線', 'the Tokyu Meguro Line, the Namboku Subway Line, and the Mita Subway Line'), row('五反田', 'ごたんだ', 'Gotanda', 'JY 23')],
  'E235 现行车内广播（目黒站前），清晰。可替换站名、车站编号、换乘；录音里没有念线路名。', {sub: 'E235 现行广播'}),
 JR('chuo', 'f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1', '中央線快速', 'JC', '#f15a22', '四ツ谷・東京方面',
  [row('新宿', 'しんじゅく', 'Shinjuku', 'JC 05', '代々木、千駄ケ谷、信濃町へおいでのお客様と、山手線、埼京線、湘南新宿ライン、小田急線、京王線、地下鉄丸ノ内線、都営地下鉄新宿線、都営地下鉄大江戸線', 'the Chuo Line local service, the Yamanote Line, the Saikyo Line, the Shonan-Shinjuku Line, the Odakyu Line, the Keio Line, the Marunouchi Subway Line, the Shinjuku Subway Line, and the Oedo Subway Line'), row('四ツ谷', 'よつや', 'Yotsuya', 'JC 04')],
  '车内自动广播（新宿到站前），很清晰。可替换站名、编号、再下一站、换乘。', {sub: 'E233 自动广播'}),
 JR('sobu', 'cae9e0662bf94ae41a5da3c2c1e50892', '総武快速線', 'JO', '#0067c0', '千葉・成田空港方面',
  [row('錦糸町', 'きんしちょう', 'Kinshicho', 'JO 22', '亀戸・平井へおいでのお客様と、地下鉄半蔵門線', 'the Sobu Line local service and the Hanzomon Subway Line'), row('新小岩', 'しんこいわ', 'Shin-Koiwa', 'JO 23')],
  '车内广播（錦糸町站前），清晰。可替换站名、编号、再下一站、换乘。', {sub: 'E235 广播'}),
 JR('keiyo', '55e540aa82543448a2360c58e7692359', '京葉線', 'JE', '#c9242f', '東京方面',
  [row('葛西臨海公園', '葛西臨海公園', 'Kasai-Rinkai Park', 'JE 06'), row('新木場', 'しんきば', 'Shin-Kiba', 'JE 05')],
  '车内广播（舞浜→葛西臨海公園），清晰。可替换线路名、终点、站名、编号。', {sub: '可换线路名和终点', terminal: '東京'}),
 JR('tokaido', '7548577c27ebf1a913f148f41f74efc4', '東海道線', 'JT', '#f68b1e', '横浜・小田原方面',
  [row('横浜', 'よこはま', 'Yokohama', 'JT 05'), row('戸塚', 'とつか', 'Totsuka', 'JT 06')],
  '普通列车车内广播（横浜站前），很清晰。可替换站名、编号。', {sub: '很清晰'}),
 JR('takasaki', 'bdc2617d2fba3d1dc453d5aa18aa360c', '高崎線', 'JU', '#f68b1e', '大宮・高崎方面',
  [row('浦和', 'うらわ', 'Urawa', 'JU 05'), row('さいたま新都心', 'さいたましんとしん', 'Saitama-Shintoshin', 'JU 06')],
  '车内广播（浦和站前），很清晰。可替换站名、编号。', {sub: '很清晰'}),
 JR('utsunomiya', '25e42318af4f221fd284342d2966e8b7', '宇都宮線', 'JU', '#f68b1e', '上野・東京方面',
  [row('東大宮', 'ひがしおおみや', 'Higashi-Omiya'), row('土呂', 'とろ', 'Toro')],
  '车内广播（東大宮站前），清晰。可替换站名。', {sub: '清晰'}),

];
