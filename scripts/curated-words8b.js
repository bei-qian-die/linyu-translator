'use strict';

// 第八轮词库扩充 · 第二部分：游戏分区英雄淋语外号 + 圈层黑话 + 构词法
//
// 分区写在 slot 字段：英雄淋盟（LOL）/ 王者淋耀 / 淋神（原神）/ 第五淋格 /
// 街头霸淋 / 瓦罗淋特 / 圈层黑话 / 构词法。
// 来源与前一份同源，全部是可访问 URL；拿不准是否属于淋语、只有泛用游戏外号的，
// sense 里明确标注「泛用/待确认」，不冒充淋语独创。

const MG = 'https://zh.moegirl.org.cn/%E6%B7%8B%E8%AF%AD';
const MOE = 'https://moegirl.uk/index.php?title=%E6%B7%8B%E6%96%87%E5%8C%96';
const NGA1 = 'https://ngabbs.com/read.php?tid=35415432';
const NGA2 = 'https://bbs.nga.cn/read.php?tid=39308402';
const NGA3 = 'https://nga.178.com/read.php?tid=42400715';
const NGA4 = 'https://bbs.nga.cn/read.php?tid=37209701';
const NGA5 = 'https://bbs.nga.cn/read.php?tid=35415629';
const GH = 'https://github.com/Aziteee/linyu-translator/blob/main/src/modules/linyu.ts';
const SYD = 'https://www.sydneytoday.com/content-50004642545';
const WX =
  'http://mp.weixin.qq.com/s?__biz=MzUyNTEwNjIxMg==&mid=2247483742&idx=3&sn=0c3f25da4446cb840bba1752cf9bb73e';
const DOU = 'https://www.douban.com/group/topic/148957880/';

/** @type {Array<object>} */
const words = [
  // ══════════════ 英雄淋盟（英雄联盟）══════════════
  { zh: '阿狸', linyu: '我狸', alias: '我狸、你狸、肛塞女、逃跑天后、杂技天后、杂技女王、搓澡技师、刮痧婆、赔钱货、阿狸', slot: '英雄淋盟', sense: '英雄联盟里外号最多的英雄：q 技能像刮痧叫刮痧婆、w 位移逃跑叫逃跑天后、嘲讽强度不够叫赔钱货。', source: NGA4, pop: '高', rel: ['你狸'] },
  { zh: '卡莎', linyu: '蟑螂婆', alias: '蟑螂婆、蟑螂女、你莎', slot: '英雄淋盟', sense: '技能像发射蟑螂卵、飞行姿态被说成蟑螂，故名。', source: NGA3, pop: '高', rel: ['婆婆'] },
  { zh: '薇恩', linyu: '滚地婆', alias: '滚地婆、VN、峡谷清洁工', slot: '英雄淋盟', sense: 'Q 技能翻滚像在扫地，被封为「峡谷清洁工」。', source: NGA3, pop: '高', rel: ['婆婆'] },
  { zh: '丽桑卓', linyu: '尖叫婆', alias: '尖叫婆、冰女', slot: '英雄淋盟', sense: '放技能时不时叫一声，故名尖叫婆。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '佐伊', linyu: '狗洞婆', alias: '狗洞婆、拾荒婆、A女', slot: '英雄淋盟', sense: '大招动画像钻狗洞叫狗洞婆；也有人按捡技能的特点叫拾荒婆。', source: NGA3, pop: '中', rel: ['婆婆'] },
  { zh: '阿卡丽', linyu: '插秧婆', alias: '插秧婆、我栗', slot: '英雄淋盟', sense: 'Q 技能姿势神似插秧，故名。', source: NGA2, pop: '高', rel: ['婆婆'] },
  { zh: '卡特琳娜', linyu: '卡迪匕', alias: '卡迪匕、捡匕婆、挨打婆', slot: '英雄淋盟', sense: '捡匕首的动作被谐音成「卡迪匕」，也叫捡匕婆。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '金克丝', linyu: '害人金', alias: '害人金、害人精、疯婆子、我疯', slot: '英雄淋盟', sense: '「害人精」谐音成「害人金」，配合她疯癫人设又叫疯婆子。', source: NGA2, pop: '高', rel: ['你疯'] },
  { zh: '艾希', linyu: '熹贵妃', alias: '熹贵妃、尿分叉婆', slot: '英雄淋盟', sense: '走清宫位分体系被封熹贵妃；大招箭雨散射叫尿分叉婆。', source: NGA4, pop: '中', rel: ['贵人'] },
  { zh: '莫甘娜', linyu: '地沟油婆', alias: '地沟油婆、泼脏水婆、油', slot: '英雄淋盟', sense: '技能以暗色液体为主，被叫地沟油婆、泼脏水婆。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '萨勒芬妮', linyu: '卡拉OK婆', alias: '卡拉OK婆、轮椅婆、你茶', slot: '英雄淋盟', sense: '登场就是唱歌而且常年坐悬浮台，被叫卡拉OK婆、轮椅婆。', source: NGA4, pop: '中', rel: ['你茶'] },
  { zh: '霞', linyu: '掉毛母鸡', alias: '掉毛母鸡、掉毛婆、脱发婆、拔毛鸡', slot: '英雄淋盟', sense: '羽刃造型像鸡毛，四个外号说的都是掉毛这件事。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '婕拉', linyu: '走路草', alias: '走路草、走路草女士', slot: '英雄淋盟', sense: '被动种子会走路，故名走路草。', source: NGA3, pop: '低', rel: [] },
  { zh: '卡尔玛', linyu: '气功婆', alias: '气功婆、诈捐婆、做法害人婆、黑皮农妇、黑丝农妇、钢筋铁骨老妇女、皮肤限定婆、大悲咒bgm演奏家、玛婆', slot: '英雄淋盟', sense: '外号第二多的英雄：技能像发气功、大招像做法事、皮肤常年限定，各有一个外号。', source: NGA4, pop: '高', rel: ['婆婆'] },
  { zh: '露露', linyu: '紫皮大蒜', alias: '紫皮大蒜、大蒜婆', slot: '英雄淋盟', sense: '变羊/变大的造型被联想成紫皮大蒜，源自淋吧发扬光大的一支梗。', source: SYD, pop: '中', rel: ['婆婆'] },
  { zh: '娜美', linyu: '喷水婆', alias: '喷水婆、罗鱼凤、小三鱼、知三当三、你鱼、鱼婆', slot: '英雄淋盟', sense: '人鱼设定 + 水技能 + 剧情里的一段三角关系，外号全凑齐了。', source: NGA4, pop: '中', rel: ['你鱼'] },
  { zh: '迦娜', linyu: '厕风', alias: '厕风、风女', slot: '英雄淋盟', sense: '风女常被贬作「厕风」，与「厕警」同属厕所系列。', source: NGA4, pop: '低', rel: [] },
  { zh: '希维尔', linyu: '送披婆', alias: '送披婆、送披女、轮子妈、我轮', slot: '英雄淋盟', sense: '回旋镖像送披萨，叫送披婆；又因为武器是轮子叫轮子妈。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '奎因', linyu: '玩鸟婆', alias: '玩鸟婆、鸟人', slot: '英雄淋盟', sense: '身边常驻一只鹰，故名玩鸟婆。', source: NGA2, pop: '低', rel: ['婆婆'] },
  { zh: '蕾欧娜', linyu: '迟钝女T', alias: '迟钝女T、日女、铁T', slot: '英雄淋盟', sense: '日女被归进「铁T」体系，又称迟钝女T。', source: NGA2, pop: '中', rel: ['铁T'] },
  { zh: '蔚', linyu: '铁T', alias: '铁T、铁T蔚', slot: '英雄淋盟', sense: '短发硬朗的女角色一律归「铁T」，蔚是代表之一。', source: NGA2, pop: '中', rel: ['铁T'] },
  { zh: '妮蔻', linyu: '缅北电诈婆', alias: '缅北电诈婆', slot: '英雄淋盟', sense: '变身伪装技能像电信诈骗，故名。', source: NGA2, pop: '中', rel: ['婆婆'] },
  { zh: '琪亚娜', linyu: '祺贵人', alias: '祺贵人、呼啦圈婆、花圈女、超模姐', slot: '英雄淋盟', sense: '谐音《甄嬛传》祺贵人；武器是个圈，又叫呼啦圈婆。', source: NGA3, pop: '中', rel: ['贵人'] },
  { zh: '格温', linyu: '剪秋', alias: '剪秋、剪刀妹', slot: '英雄淋盟', sense: '谐音《甄嬛传》剪秋，与「浣碧=芮尔」同属清宫剧人名梗。', source: NGA3, pop: '中', rel: ['贵人'] },
  { zh: '卡蜜尔', linyu: '剪刀婆', alias: '剪刀婆、青钢影、圆规、祥林嫂', slot: '英雄淋盟', sense: '腿刀像剪刀，叫剪刀婆、圆规；台词絮叨故名祥林嫂。', source: NGA4, pop: '中', rel: ['婆婆'] },
  { zh: '俄洛伊', linyu: '皮鞭脚踩婆', alias: '皮鞭脚踩婆、壮壮妈', slot: '英雄淋盟', sense: '触手拍击 + 壮硕体型，外号偏重口味。', source: NGA2, pop: '低', rel: ['婆婆'] },
  { zh: '泽丽', linyu: '漏电婆', alias: '漏电婆、绿头苍蝇', slot: '英雄淋盟', sense: '电系技能叫漏电婆，造型配色被叫绿头苍蝇。', source: NGA2, pop: '低', rel: ['婆婆'] },
  { zh: '烈娜塔', linyu: 'rush婆', alias: 'rush婆、香水婆、恋精男爵、祖安董明珠', slot: '英雄淋盟', sense: '香水瓶技能叫香水婆；R 技能群体狂热叫 rush 婆。', source: NGA3, pop: '低', rel: ['婆婆'] },
  { zh: '莎弥拉', linyu: '土匪婆', alias: '土匪婆、萨弥拉', slot: '英雄淋盟', sense: '双枪连射风格粗野，被叫土匪婆。', source: NGA3, pop: '低', rel: ['婆婆'] },
  { zh: '赛娜', linyu: '拾荒婆', alias: '拾荒婆', slot: '英雄淋盟', sense: '捡灵魂/捡黑雾的设定，与佐伊共用「拾荒婆」这个外号。', source: NGA3, pop: '低', rel: ['婆婆'] },
  { zh: '安妮', linyu: '阴妮', alias: '阴妮、你抽、抽搐女、喜熊妹', slot: '英雄淋盟', sense: 'Q 技能前摇短、够不到人时抬手像抽搐，故称抽搐女；提伯斯是熊又叫喜熊妹。', source: NGA3, pop: '中', rel: ['你抽'] },
  { zh: '好运姐', linyu: '好孕姐', alias: '好孕姐、你孕、大步流腥', slot: '英雄淋盟', sense: '「好运」谐音成「好孕」，另有谐音写法大步流腥。', source: NGA2, pop: '中', rel: ['你孕'] },
  { zh: '阿木木', linyu: '殇之木奶1', alias: '殇之木奶1、殇之母奶1', slot: '英雄淋盟', sense: '「殇之木乃伊」的淋化写法，这句是淋吧外号里最出圈的一个。', source: SYD, pop: '中', rel: [] },
  { zh: '卡西奥佩娅', linyu: '赤脚婆', alias: '赤脚婆、蚯蚓婆', slot: '英雄淋盟', sense: '下半身是蛇尾没有脚，故名赤脚婆、蚯蚓婆。', source: NGA2, pop: '低', rel: ['婆婆'] },
  { zh: '黛安娜', linyu: '母石头人', alias: '母石头人、皎月', slot: '英雄淋盟', sense: '月牙武器 + 硬朗身形，被叫母石头人。', source: NGA2, pop: '低', rel: [] },
  { zh: '索拉卡', linyu: '母角马', alias: '母角马、星妈', slot: '英雄淋盟', sense: '独角兽/星界设定被叫母角马、星妈。', source: NGA2, pop: '低', rel: [] },
  { zh: '艾瑞莉娅', linyu: '母亚索', alias: '母亚索、刀妹', slot: '英雄淋盟', sense: '刀锋起舞的身法像亚索，故名母亚索。', source: NGA3, pop: '中', rel: [] },
  { zh: '芮尔', linyu: '浣碧', alias: '浣碧、浣B', slot: '英雄淋盟', sense: '谐音《甄嬛传》浣碧，是完全看不出角色特点的一支梗。', source: NGA3, pop: '低', rel: ['格温'] },
  { zh: '尼菈', linyu: '好彩妹', alias: '好彩妹、水弥拉', slot: '英雄淋盟', sense: '「尼菈」谐音成水弥拉、好彩妹。', source: SYD, pop: '低', rel: [] },
  { zh: '图奇', linyu: '温宜公主', alias: '温宜公主、瘟疫公主、老鼠', slot: '英雄淋盟', sense: '谐音「瘟疫公主」，与清宫剧人名梗同体系。', source: NGA2, pop: '低', rel: ['贵人'] },
  { zh: '克烈', linyu: '嘴臭怪物', alias: '嘴臭怪物', slot: '英雄淋盟', sense: '台词骂骂咧咧，故名嘴臭怪物。', source: SYD, pop: '低', rel: [] },
  { zh: '乐芙兰', linyu: '幺蛾子', alias: '幺蛾子、妖姬', slot: '英雄淋盟', sense: '分身幻象多、花样多，叫幺蛾子。', source: SYD, pop: '低', rel: [] },
  { zh: '奈德丽', linyu: '女野人', alias: '女野人', slot: '英雄淋盟', sense: '兽形态 + 丛林设定，被叫女野人。', source: SYD, pop: '低', rel: [] },
  { zh: '墨菲特', linyu: '金刚贝塔', alias: '金刚贝塔、石头人', slot: '英雄淋盟', sense: '石头身躯配上淋语圈代表符号「贝塔」，得名金刚贝塔。', source: NGA2, pop: '低', rel: ['贝塔'] },
  { zh: '奥莉安娜', linyu: '硅胶魔淋', alias: '硅胶魔淋、发条、你条', slot: '英雄淋盟', sense: '「魔灵」淋化成「魔淋」，发条娃娃质感又叫硅胶。', source: NGA2, pop: '低', rel: [] },
  { zh: '莉莉娅', linyu: '母诺手', alias: '母诺手', slot: '英雄淋盟', sense: '被动叠层像诺克萨斯之手，故名母诺手。', source: NGA2, pop: '低', rel: [] },
  { zh: '凯特琳', linyu: '厕警', alias: '厕警、女警', slot: '英雄淋盟', sense: '与「厕风」同属厕所系列贬称。', source: NGA4, pop: '低', rel: [] },
  { zh: '伊泽瑞尔', linyu: '母拉拉', alias: '母拉拉、哑哑、EZ', slot: '英雄淋盟', sense: '男英雄也逃不过娘化外号，EZ 被叫母拉拉、efls 被叫哑哑。', source: NGA2, pop: '低', rel: [] },
  { zh: '孙悟空', linyu: '六小淋童', alias: '六小淋童、阴🐒', slot: '英雄淋盟', sense: '「六小龄童」的淋化写法，是淋吧外号里传播最广的一个。', source: SYD, pop: '中', rel: [] },
  { zh: '小丑', linyu: '阴暗面', alias: '阴暗面、阴暗面的我光', slot: '英雄淋盟', sense: '与「我光（光辉）」互为对照，被我光玩家抢着叫阴暗面。', source: NGA3, pop: '低', rel: ['你胱'] },

  // ══════════════ 王者淋耀（王者荣耀）══════════════
  { zh: '西施', linyu: '拉客妹', alias: '拉客妹、吸虱', slot: '王者淋耀', sense: '「西施」谐音吸虱，技能拉人叫拉客妹。', source: GH, pop: '中', rel: [] },
  { zh: '王昭君', linyu: '鸡菌', alias: '鸡菌', slot: '王者淋耀', sense: '谐音梗，与「吸虱」同属把角色名谐音成食物的写法。', source: GH, pop: '中', rel: [] },
  { zh: '不知火舞', linyu: '东瀛女特务', alias: '东瀛女特务', slot: '王者淋耀', sense: '日系忍者造型 + 扇子，被叫东瀛女特务。', source: GH, pop: '低', rel: [] },
  { zh: '上官婉儿', linyu: '蒜姐', alias: '蒜姐、飞天婆', slot: '王者淋耀', sense: '大招飞天叫飞天婆，另有蒜姐的谐音外号。', source: GH, pop: '中', rel: ['婆婆'] },
  { zh: '米莱狄', linyu: '超生婆', alias: '超生婆、下蛋婆、米莱迪', slot: '王者淋耀', sense: '机械仆从不断产出，被叫超生婆、下蛋婆。', source: GH, pop: '中', rel: ['婆婆'] },
  { zh: '安琪拉', linyu: '安嫔', alias: '安嫔', slot: '王者淋耀', sense: '走清宫位分体系，封为安嫔。', source: GH, pop: '低', rel: ['贵人'] },
  { zh: '公孙离', linyu: '驴姐', alias: '驴姐', slot: '王者淋耀', sense: '谐音 + 位移多的特点，叫驴姐。', source: GH, pop: '低', rel: [] },
  { zh: '小乔', linyu: '矮子乔', alias: '矮子乔', slot: '王者淋耀', sense: '模型身材矮小，故名矮子乔。', source: GH, pop: '低', rel: [] },
  { zh: '沈梦溪', linyu: '阴猫', alias: '阴猫', slot: '王者淋耀', sense: '猫形态 + 阴字替换，叫阴猫。', source: GH, pop: '低', rel: [] },
  { zh: '孙尚香', linyu: '滚地婆', alias: '滚地婆', slot: '王者淋耀', sense: '翻滚射击，与 LOL 薇恩共用「滚地婆」。', source: GH, pop: '低', rel: ['婆婆'] },
  { zh: '艾琳', linyu: '蚊子婆', alias: '蚊子婆', slot: '王者淋耀', sense: '箭矢细小密集像蚊子，故名。', source: GH, pop: '低', rel: ['婆婆'] },
  { zh: '花木兰', linyu: '花铁t', alias: '花铁t、铁t', slot: '王者淋耀', sense: '短发硬朗造型归进铁T体系。', source: GH, pop: '低', rel: ['铁T'] },
  { zh: '夏洛特', linyu: '夏铁t', alias: '夏铁t、西洋女特务', slot: '王者淋耀', sense: '同为短发女角色，另有西洋女特务的称呼。', source: GH, pop: '低', rel: ['铁T'] },
  { zh: '孙膑', linyu: '孙答应', alias: '孙答应', slot: '王者淋耀', sense: '清宫位分体系里的「答应」一级。', source: GH, pop: '低', rel: ['贵人'] },
  { zh: '百里守约', linyu: '阴约', alias: '阴约', slot: '王者淋耀', sense: '阴字替换：守约 → 阴约。', source: GH, pop: '低', rel: [] },
  { zh: '诸葛亮', linyu: '母亮', alias: '母亮', slot: '王者淋耀', sense: '男英雄娘化：亮 → 母亮。', source: GH, pop: '低', rel: [] },
  { zh: '韩信', linyu: '阴信', alias: '阴信', slot: '王者淋耀', sense: '阴字替换：信 → 阴信。', source: GH, pop: '低', rel: [] },
  { zh: '元歌', linyu: '阴歌', alias: '阴歌', slot: '王者淋耀', sense: '阴字替换：歌 → 阴歌。', source: GH, pop: '低', rel: [] },
  { zh: '扁鹊', linyu: '下毒婆', alias: '下毒婆', slot: '王者淋耀', sense: '技能以毒为主，故名下毒婆。', source: GH, pop: '低', rel: ['婆婆'] },
  { zh: '明世隐', linyu: '明公公', alias: '明公公、世隐', slot: '王者淋耀', sense: '太监人设 + 姓明，叫明公公。', source: GH, pop: '低', rel: [] },
  { zh: '狄仁杰', linyu: '狄公公', alias: '狄公公', slot: '王者淋耀', sense: '与明公公同属公公系列。', source: GH, pop: '低', rel: [] },
  { zh: '云缨', linyu: '孕婴', alias: '孕婴', slot: '王者淋耀', sense: '谐音梗。', source: GH, pop: '低', rel: [] },
  { zh: '司空震', linyu: '司空daddy', alias: '司空daddy', slot: '王者淋耀', sense: '中英混用：成熟男角色叫 daddy。', source: GH, pop: '低', rel: [] },
  { zh: '暃', linyu: '母妃', alias: '母妃', slot: '王者淋耀', sense: '男英雄娘化 + 位分：暃 → 母妃。', source: GH, pop: '低', rel: ['贵人'] },
  { zh: '曜', linyu: '臭脚曜', alias: '臭脚曜、🐭曜', slot: '王者淋耀', sense: '两个外号对应两个嘲点，emoji 版用于弹幕。', source: GH, pop: '低', rel: [] },

  // ══════════════ 淋神（原神）══════════════
  { zh: '可莉', linyu: '炸弹婆', alias: '炸弹婆、蹦蹦炸弹', slot: '淋神', sense: '炸弹专精的萝莉角色，淋语按「XX婆」构词。', source: GH, pop: '中', rel: ['婆婆'] },
  { zh: '七七', linyu: '僵尸婆', alias: '僵尸婆、僵尸', slot: '淋神', sense: '僵尸设定，淋语叫僵尸婆。', source: GH, pop: '中', rel: ['婆婆'] },
  { zh: '夜兰', linyu: '我腋', alias: '我腋、蓝色妖姬', slot: '淋神', sense: '「夜」谐音腋，套用「我X」自称体系。', source: GH, pop: '中', rel: ['我'] },
  { zh: '优菈', linyu: '铁T拉', alias: '铁T拉、浪花骑士', slot: '淋神', sense: '短发硬朗女角色归进铁T体系，铁T拉是标准写法。', source: NGA5, pop: '中', rel: ['铁T'] },
  { zh: '北斗', linyu: '铁T斗', alias: '铁T斗、大姐头', slot: '淋神', sense: '同为短发硬朗型，叫铁T斗。', source: NGA5, pop: '低', rel: ['铁T'] },
  { zh: '迪希雅', linyu: '铁T雅', alias: '铁T雅、炎拳', slot: '淋神', sense: '同为短发硬朗型，叫铁T雅。', source: NGA5, pop: '低', rel: ['铁T'] },
  { zh: '雷电将军', linyu: '煮饭婆', alias: '煮饭婆、宅女、影', slot: '淋神', sense: '泛用/待确认：煮饭婆是原神圈通用外号，游戏区通讯录沿用后带淋语色彩。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '中', rel: ['婆婆'] },
  { zh: '纳西妲', linyu: '羽毛球', alias: '羽毛球、小草神', slot: '淋神', sense: '泛用/待确认：羽毛球是原神圈通用外号，淋语化程度待确认。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },
  { zh: '妮露', linyu: '红牛', alias: '红牛、舞娘', slot: '淋神', sense: '泛用/待确认：红牛是原神圈通用外号；「舞娘」与淋淋《舞娘》形成双关后被淋语圈借用。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },
  { zh: '胡桃', linyu: '堂主', alias: '堂主、桃子', slot: '淋神', sense: '泛用/待确认：堂主是原神圈通用称呼。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },
  { zh: '甘雨', linyu: '王小美', alias: '王小美、椰羊', slot: '淋神', sense: '泛用/待确认：王小美、椰羊均为原神圈通用外号。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },
  { zh: '刻晴', linyu: '牛杂师傅', alias: '牛杂师傅、玉衡星、阿晴', slot: '淋神', sense: '泛用/待确认：牛杂师傅是原神圈通用外号。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },
  { zh: '八重神子', linyu: '屑狐狸', alias: '屑狐狸、狐狸、八重宫司', slot: '淋神', sense: '泛用/待确认：屑狐狸是原神圈通用外号，狐狸意象与淋语的花蝴蝶系列相合。', source: 'https://www.miyoushe.com/bh3/article/44895323', pop: '低', rel: [] },

  // ══════════════ 第五淋格（第五人格）══════════════
  { zh: '医生', linyu: '尖叫婆', alias: '尖叫婆', slot: '第五淋格', sense: '被击中或击倒时会发出全场可听的尖叫，故名尖叫婆。', source: DOU, pop: '中', rel: ['婆婆'] },
  { zh: '渔女', linyu: '脚气婆', alias: '脚气婆', slot: '第五淋格', sense: '圈内黑称，来源与其外形/技能观感有关，属争议性外号。', source: DOU, pop: '低', rel: ['婆婆'] },
  { zh: '调香师', linyu: '调马师', alias: '调马师', slot: '第五淋格', sense: '圈内谐音黑称，与「小马孩」同属第五人格区的一支。', source: DOU, pop: '低', rel: [] },
  { zh: '小女孩', linyu: '小马孩', alias: '小马孩', slot: '第五淋格', sense: '圈内谐音黑称，第五人格社区厌女氛围下的产物，属争议性外号。', source: DOU, pop: '低', rel: [] },
  { zh: '祭司', linyu: '井盖娘', alias: '井盖娘', slot: '第五淋格', sense: '泛用/待确认：井盖娘是第五人格圈通用外号（穿墙洞像地铁逃票）。', source: 'https://www.sosocq.com/zixun/60424.html', pop: '低', rel: [] },

  // ══════════════ 街头霸淋 / 瓦罗淋特 ══════════════
  { zh: '春丽', linyu: '春淋女士', alias: '春淋女士', slot: '街头霸淋', sense: '「春丽」淋化成「春淋」，套女士敬称。', source: GH, pop: '低', rel: [] },
  { zh: '阿鬼', linyu: '我鬼', alias: '我鬼', slot: '街头霸淋', sense: '「我X」自称体系在格斗游戏区的延伸。', source: GH, pop: '低', rel: ['我'] },
  { zh: '曼侬', linyu: '我侬', alias: '我侬', slot: '街头霸淋', sense: '同上，我 + 角色名单字。', source: GH, pop: '低', rel: ['我'] },
  { zh: '嘉米', linyu: '我咪', alias: '我咪', slot: '街头霸淋', sense: '同上。', source: GH, pop: '低', rel: ['我'] },
  { zh: '维嘉', linyu: '维嘉大妈', alias: '维嘉大妈', slot: '街头霸淋', sense: '反派 boss 娘化叫大妈。', source: GH, pop: '低', rel: [] },
  { zh: '影罗', linyu: '阴罗', alias: '阴罗', slot: '街头霸淋', sense: '阴字替换：影 → 阴。', source: GH, pop: '低', rel: [] },
  { zh: '蝰蛇', linyu: '我🐍', alias: '我🐍', slot: '瓦罗淋特', sense: '「我 + emoji」是瓦罗淋特区的构词法，emoji 代替角色特征。', source: GH, pop: '低', rel: ['我'] },
  { zh: '暮蝶', linyu: '我🦋', alias: '我🦋', slot: '瓦罗淋特', sense: '同上。', source: GH, pop: '低', rel: ['我'] },
  { zh: '钢索', linyu: '我🔒', alias: '我🔒', slot: '瓦罗淋特', sense: '同上。', source: GH, pop: '低', rel: ['我'] },
  { zh: '黑梦', linyu: '我梦', alias: '我梦', slot: '瓦罗淋特', sense: '「我X」自称体系。', source: GH, pop: '低', rel: ['我'] },
  { zh: '奇乐', linyu: '🐔婆', alias: '🐔婆、鸡婆', slot: '瓦罗淋特', sense: '「鸡」在淋语里可作通用代词，配 emoji 写成🐔婆。', source: GH, pop: '低', rel: ['婆婆'] },

  // ══════════════ 圈层黑话 ══════════════
  { zh: '淋王星', linyu: '淋王星', alias: '淋王星、淋球、淋星', slot: '圈层黑话', sense: '以淋文化为基础的虚构社区，淋语被设定为它的官方语言，使用者自称淋王星子民。', source: MOE, pop: '高', rel: ['淋语'] },
  { zh: '宇宙天后', linyu: '宇宙天后', alias: '天后、宇宙之母、淋淋', slot: '圈层黑话', sense: '淋淋的封号之一；淋文化要点第一条就是「淋淋是宇宙之母」。', source: MOE, pop: '高', rel: ['蔡依林'] },
  { zh: '伪骑士', linyu: '伪骑士', alias: '伪骑士、假骑士', slot: '圈层黑话', sense: '与「本质骑士」相对，指只追蔡依林本人、不接受淋文化的粉丝。', source: MOE, pop: '中', rel: ['粉丝'] },
  { zh: '淋图', linyu: '淋图', alias: '淋图、淋系表情包', slot: '圈层黑话', sense: '把淋淋的舞蹈动作、脸部表情配上电影画面做成的恶搞图，是淋语的重要组成部分。', source: MOE, pop: '中', rel: ['淋剧'] },
  { zh: '淋剧', linyu: '淋剧', alias: '淋剧、淋系小剧场', slot: '圈层黑话', sense: '用公众人物和骑士的面目进行剧情创作的二创作品。', source: MOE, pop: '中', rel: ['淋图'] },
  { zh: '三木木吧', linyu: '三木木吧', alias: '三木木、木木吧', slot: '圈层黑话', sense: '淋文化的发源地贴吧，由 Oricon 吧、Billboard 吧的吧友因抄袭争议而建。', source: MOE, pop: '中', rel: ['淋语'] },
  { zh: '肩上的脚丫吧', linyu: '肩上的脚丫吧', alias: '脚丫吧', slot: '圈层黑话', sense: '三木木吧被禁后难民的主要去处，LGBT 圈子属性强，淋语在此进入基圈。', source: MOE, pop: '中', rel: ['三木木吧'] },
  { zh: '美甲', linyu: '💅🏻', alias: '💅🏻、美甲emoji', slot: '圈层黑话', sense: '美甲 emoji 是淋语圈的代表符号，源头是罗玉凤在美甲店打工的经历。', source: MOE, pop: '高', rel: ['罗玉凤'] },
  { zh: '仙都', linyu: '仙都', alias: '仙都、南宁', slot: '圈层黑话', sense: '周阴婷住址所在的南宁市被戏称为仙都，住址本身成为打卡圣地。', source: MOE, pop: '中', rel: ['周阴婷'] },
  { zh: '130', linyu: '130', alias: '130次、13次、13、1.3、0.13', slot: '圈层黑话', sense: '淋语圈的代表数字，另有 13 / 1.3 / 0.13 等变体，用法如「砍你130刀」「买榜130次」。', source: MG, pop: '高', rel: ['乌干达', '贝塔'] },
  { zh: '乌干达', linyu: '乌干达', alias: '乌干达、几把、鸡巴', slot: '圈层黑话', sense: '淋语里的隐晦代称，也是「奖励130根乌干达」这类句式的计量单位。', source: GH, pop: '中', rel: ['130'] },
  { zh: '贝塔', linyu: '贝塔', alias: '贝塔、β、淋A()C', slot: '圈层黑话', sense: '淋语圈的核心隐语之一，衍生出「贝塔已经锁定你」这类弹幕诗。', source: NGA1, pop: '中', rel: ['130', '乌干达'] },
  { zh: '吸', linyu: '吸', alias: '吸、开吸、被吸、吸入、进b、难逃一吸', slot: '圈层黑话', sense: '淋B 会吸入宇宙万物的设定衍生出的动词，是淋语最经典的恐吓式表达。', source: MOE, pop: '高', rel: ['难逃'] },
  { zh: '开吸', linyu: '开吸', alias: '开吸、被吸、吸了', slot: '圈层黑话', sense: '「吸」的起始式，弹幕在高能画面前整屏刷。', source: MOE, pop: '中', rel: ['吸'] },
  { zh: 'nbcs', linyu: 'nbcs', alias: 'nbcs、无人在意、没人在意', slot: '圈层黑话', sense: 'nobody cares 的缩写，是淋语圈使用频率最高的英文缩写之一。', source: GH, pop: '高', rel: ['无人在意'] },
  { zh: 'bfnz', linyu: 'bfnz', alias: 'bfnz、逼飞奶炸', slot: '圈层黑话', sense: '「逼飞奶炸」的四字缩写，属淋语里较粗俗的一支。', source: GH, pop: '低', rel: [] },
  { zh: '尼美舒利', linyu: '尼美舒利', alias: '尼美舒利、nmsl', slot: '圈层黑话', sense: '「nmsl」的药物名谐音写法，出自淋文化传播大使周阴婷之口，属阴语不属淋语本体。', source: WX, pop: '中', rel: ['周阴婷'] },
  { zh: '春芝', linyu: '春芝', alias: '春芝、蠢直', slot: '圈层黑话', sense: '「蠢直」的淋化谐音，用来骂不解风情的人。', source: GH, pop: '中', rel: ['直男'] },
  { zh: '甜椒婆', linyu: '甜椒婆', alias: '甜椒婆、足控', slot: '圈层黑话', sense: '「足控」的淋语说法，按 XX婆 构词。', source: GH, pop: '低', rel: ['婆婆'] },
  { zh: '淋听', linyu: '淋听', alias: '淋听、聆听', slot: '构词法', sense: '淋字嵌入：聆 → 淋。淋字替换是淋语最基础的造词法之一。', source: GH, pop: '中', rel: ['淋字嵌入'] },
  { zh: '阴到', linyu: '阴到', alias: '阴到、得到、获得', slot: '构词法', sense: '阴字替换：得 → 阴。「得到/获得」一律写成阴到。', source: GH, pop: '中', rel: ['阴字替换'] },
  { zh: '孝鼠', linyu: '孝鼠', alias: '孝鼠、笑死', slot: '构词法', sense: '「笑死」的另一种淋化写法，与「笑鼠」并存。', source: GH, pop: '中', rel: ['笑死'] },
  { zh: '洗翻', linyu: '洗翻', alias: '洗翻、喜欢', slot: '构词法', sense: '「喜欢」的另一种淋化写法，与「喜翻」并存。', source: GH, pop: '中', rel: ['喜欢'] },
  { zh: 'Big胆', linyu: 'Big胆', alias: 'Big胆、big胆、大胆', slot: '构词法', sense: '中英混用：大胆 → big胆，与「美cry」同类。', source: MG, pop: '高', rel: ['哭'] },
  { zh: '轰', linyu: '轰', alias: '轰、厚、嚯', slot: '语气词', sense: '「厚」的加强版，即「嚯」，语气比厚更强烈。', source: MG, pop: '中', rel: ['厚'] },
  { zh: '啾咪', linyu: '啾咪', alias: '啾咪、么么、亲亲', slot: '情绪', sense: '卖萌、装可爱专用语气词，也可代表亲吻的声音。', source: MG, pop: '高', rel: ['亲亲'] },
  { zh: '熏', linyu: '熏', alias: '熏、心', slot: '构词法', sense: '「心」的台湾腔发音，凡是带心的词都换成熏：开心→开熏、恶心→恶熏。', source: MG, pop: '高', rel: ['心'] },
  { zh: '柱', linyu: '柱', alias: '柱、子', slot: '构词法', sense: '「子」的台湾腔发音：孩子→孩柱、样子→样柱、婊子→婊柱。', source: MG, pop: '高', rel: ['子'] },
  { zh: '素', linyu: '素', alias: '素、是、系', slot: '构词法', sense: '「是」的台湾腔发音，是淋语出现频率最高的单字。', source: MG, pop: '高', rel: ['是'] },
  { zh: '珍', linyu: '珍', alias: '珍、尊、真', slot: '构词法', sense: '「真」的台湾腔发音，写作珍或尊，如珍素/尊素。', source: MG, pop: '高', rel: ['真的'] },
  { zh: '鼠', linyu: '鼠', alias: '鼠、死', slot: '构词法', sense: '「死」的台湾腔发音，是淋语里最稳定的一条替换规则。', source: MG, pop: '高', rel: ['死'] },
  { zh: '靴', linyu: '靴', alias: '靴、谢', slot: '构词法', sense: '「谢」的淋化字，来自模拟淋淋的 hia hia 笑声（闽南语靴读 hia）。', source: MG, pop: '高', rel: ['谢谢'] },
  { zh: '婷', linyu: '婷', alias: '婷、停', slot: '构词法', sense: '「停」的淋化字，婷芷 = 停止。', source: MG, pop: '高', rel: ['停止'] },
];

module.exports = { words };
