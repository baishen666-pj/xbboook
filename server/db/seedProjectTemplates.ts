import { seedBuiltins } from './repositories/projectTemplateRepo.js';

export const BUILTIN_PROJECT_TEMPLATES = [
  {
    name: '玄幻修仙',
    genre: '玄幻',
    description: '经典玄幻修仙模板：废材天才逆袭，修炼等级体系，宗门争斗',
    structure: JSON.stringify({
      project: { genre: '玄幻', writingMode: 'webnovel', writingStyle: '轻松热血', targetWords: 500000, dailyTarget: 2000 },
      characters: [
        { name: '主角', roleType: 'protagonist', gender: '男', personality: '坚韧不拔，表面低调实则野心勃勃', background: '出身平凡，天赋觉醒后被宗门收录' },
        { name: '师姐', roleType: 'supporting', gender: '女', personality: '外冷内热，实力强大', background: '宗门天才弟子，对主角照顾有加' },
        { name: '宿敌', roleType: 'antagonist', gender: '男', personality: '骄横跋扈，出身名门', background: '世家子弟，与主角同期入门' },
      ],
      worldview: [
        { category: '修炼体系', title: '灵气等级', content: '炼气→筑基→金丹→元婴→化神→渡劫→大乘→飞升，每个大境界分初期、中期、后期、巅峰' },
        { category: '势力格局', title: '三大宗门', content: '天剑宗（剑道）、丹鼎门（炼丹）、幻灵谷（阵法），各据一方' },
      ],
      outlines: [
        { title: '第一卷：灵徒之路', level: 0 },
        { title: '天赋觉醒', level: 1, content: '主角意外觉醒隐藏天赋' },
        { title: '宗门试炼', level: 1, content: '通过残酷的宗门入门考核' },
        { title: '初露锋芒', level: 1, content: '新人比武中击败宿敌，引起长老注意' },
        { title: '第二卷：宗门风云', level: 0 },
        { title: '秘境探险', level: 1, content: '进入上古秘境，获得传承' },
        { title: '宗门大比', level: 1, content: '代表宗门参加三大宗门联合比武' },
      ],
      chapters: [
        { title: '第一章 觉醒', content: '<p>清晨的阳光透过破旧的窗棂，洒在少年苍白的脸上。</p><p>他叫林逸，是青云镇一个普通的孤儿。从小在镇长大叔的接济下长大，如今十六岁，是时候去镇外的灵石矿场做工了。</p><p>「林逸！快起来，矿场来人招工了！」隔壁王婶的大嗓门准时响起。</p>' },
        { title: '第二章 灵根测试', content: '<p>灵石矿场位于青云镇北面三里处。</p><p>林逸跟着其他少年一起排队等候灵根测试。面前是一块巨大的灵石碑，只要将手掌贴上去，就能测出是否有灵根。</p><p>「下一位！」</p>' },
        { title: '第三章 入门', content: '<p>天剑宗的飞舟悬浮在半空，如同一座移动的宫殿。</p><p>林逸第一次乘坐飞舟，俯瞰大地，小镇逐渐变成了一个小点。他握紧拳头，心中暗暗发誓：总有一天，我要站在这个世界的最顶端。</p>' },
      ],
    }),
  },
  {
    name: '都市逆袭',
    genre: '都市',
    description: '都市逆袭模板：落魄青年获得机遇，商战与情场双逆袭',
    structure: JSON.stringify({
      project: { genre: '都市', writingMode: 'webnovel', writingStyle: '爽快节奏', targetWords: 300000, dailyTarget: 3000 },
      characters: [
        { name: '主角', roleType: 'protagonist', gender: '男', personality: '沉稳内敛，遇事冷静，有仇必报', background: '曾是公司骨干，被陷害后一无所有' },
        { name: '红颜知己', roleType: 'supporting', gender: '女', personality: '聪慧果敢，温柔体贴', background: '商业世家千金，外表光鲜内心孤独' },
      ],
      worldview: [
        { category: '背景设定', title: '城市格局', content: '江城：二线城市，商业竞争激烈，三大财团明争暗斗' },
      ],
      outlines: [
        { title: '第一卷：绝境重生', level: 0 },
        { title: '跌入谷底', level: 1, content: '主角被公司开除、女友离去、负债累累' },
        { title: '逆天改命', level: 1, content: '意外获得神秘系统/能力' },
        { title: '初战告捷', level: 1, content: '利用能力在商战中初露锋芒' },
      ],
      chapters: [
        { title: '第一章 绝境', content: '<p>江城的冬天格外寒冷。</p><p>林浩站在公司大楼门口，手里攥着一份解聘通知书。就在今天上午，他被公司以「严重违纪」为由开除了。</p><p>而这个理由，不过是他拒绝帮上司做假账的报复。</p>' },
        { title: '第二章 转机', content: '<p>失魂落魄地走在街头，林浩的口袋里只剩下一百多块钱。</p><p>手机响了——是前女友的婚礼请柬。</p><p>「呵。」他苦笑一声，将手机放回口袋。</p>' },
      ],
    }),
  },
  {
    name: '甜宠言情',
    genre: '言情',
    description: '甜宠言情模板：冷面总裁与元气少女的甜蜜爱情故事',
    structure: JSON.stringify({
      project: { genre: '言情', writingMode: 'webnovel', writingStyle: '甜蜜轻松', targetWords: 200000, dailyTarget: 3000 },
      characters: [
        { name: '男主', roleType: 'protagonist', gender: '男', personality: '表面冷漠，实则深情专一', background: '集团继承人，商业天才' },
        { name: '女主', roleType: 'protagonist', gender: '女', personality: '乐观开朗，善良坚强', background: '普通家庭出身，独立自主' },
      ],
      worldview: [
        { category: '社会背景', title: '都市生活', content: '现代都市，高富帅总裁与小白领的浪漫邂逅' },
      ],
      outlines: [
        { title: '第一卷：邂逅', level: 0 },
        { title: '初次相遇', level: 1, content: '命运般的偶遇' },
        { title: '再次重逢', level: 1, content: '发现竟在同一家公司' },
        { title: '暗生情愫', level: 1, content: '相处中渐生好感' },
      ],
      chapters: [
        { title: '第一章 邂逅', content: '<p>暴雨来得毫无预兆。</p><p>苏念念踩着高跟鞋狂奔在商业街上，手里举着刚买的简历文件夹当伞，狼狈至极。</p><p>一辆黑色迈巴赫无声地停在她面前，车门打开，一只修长的手递来一把伞。</p>' },
      ],
    }),
  },
  {
    name: '仙侠问道',
    genre: '仙侠',
    description: '仙侠问道模板：散修逆天改命，仙门争锋，问道长生',
    structure: JSON.stringify({
      project: { genre: '仙侠', writingMode: 'webnovel', writingStyle: '古风雅致', targetWords: 600000, dailyTarget: 2000 },
      characters: [
        { name: '主角', roleType: 'protagonist', gender: '男', personality: '洒脱不羁，重情重义', background: '散修出身，无门无派' },
      ],
      worldview: [
        { category: '仙门体系', title: '五大仙门', content: '太清宫、玄天宗、碧落宫、万妖谷、幽冥殿，各有所长' },
        { category: '修炼体系', title: '仙道境界', content: '凡人→练气→筑基→金丹→元婴→化神→合体→大乘→渡劫→真仙' },
      ],
      outlines: [
        { title: '第一卷：凡尘', level: 0 },
        { title: '踏入仙途', level: 1, content: '机缘巧合踏入修仙界' },
      ],
      chapters: [
        { title: '第一章 问仙', content: '<p>天地灵气复苏，修仙不再是传说。</p><p>少年独立于悬崖之巅，衣袂猎猎，目光坚定望向远方云海深处。</p>' },
      ],
    }),
  },
];

export function seedProjectTemplateBuiltins(): void {
  seedBuiltins(BUILTIN_PROJECT_TEMPLATES);
}
