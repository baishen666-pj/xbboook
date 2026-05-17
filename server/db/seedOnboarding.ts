import { getDb } from './database.js';
import { logger } from '../middleware/logger.js';

const EXAMPLE_PROJECT_NAME = '入门指南 — 示例作品';

export function seedExampleProject(): void {
  const db = getDb();

  // Check if example project already exists
  const existing = db.prepare(
    "SELECT id FROM projects WHERE name = ?",
  ).get(EXAMPLE_PROJECT_NAME);

  if (existing) return;

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();

  db.exec(`
    INSERT INTO projects (id, name, description, genre, writing_style, writing_mode, target_words, status, sort_order, daily_target, created_at, updated_at)
    VALUES ('${projectId}', '${EXAMPLE_PROJECT_NAME}', '这是一个示例项目，帮助你了解 Xbboook 的功能。你可以自由编辑或删除它。', '玄幻', '轻松幽默', 'webnovel', 500000, 'active', 0, 1000, '${now}', '${now}')
  `);

  // Characters
  const char1Id = crypto.randomUUID();
  const char2Id = crypto.randomUUID();
  db.exec(`
    INSERT INTO characters (id, project_id, name, nickname, role_type, gender, age, appearance, personality, background, abilities, sort_order, created_at, updated_at)
    VALUES ('${char1Id}', '${projectId}', '林逸', '逸哥', 'protagonist', '男', '18', '身材修长，黑发黑眸，剑眉星目', '表面懒散，内心坚韧，重情重义', '孤儿出身，被隐世高人收养', '天生灵体，修炼速度极快', 0, '${now}', '${now}');
    INSERT INTO characters (id, project_id, name, nickname, role_type, gender, age, appearance, personality, background, abilities, sort_order, created_at, updated_at)
    VALUES ('${char2Id}', '${projectId}', '苏晴', '晴儿', 'supporting', '女', '17', '长发如瀑，明眸皓齿，气质出尘', '外冷内热，聪慧过人', '世家千金，天赋异禀', '冰系法术，擅长阵法', 1, '${now}', '${now}')
  `);

  // Character relation
  db.exec(`
    INSERT INTO character_relations (id, project_id, character_a_id, character_b_id, relation_type, description, created_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', '${char1Id}', '${char2Id}', '同伴', '冒险途中结识的伙伴，互相扶持', '${now}')
  `);

  // Worldview
  db.exec(`
    INSERT INTO worldviews (id, project_id, category, title, content, sort_order, created_at, updated_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', '力量体系', '灵气等级', '灵徒 → 灵师 → 大灵师 → 灵王 → 灵皇 → 灵宗 → 灵圣 → 灵帝\n每个大境界分为初、中、后三个小境界。突破需要对应的天材地宝和悟性。', 0, '${now}', '${now}')
  `);

  // Outline
  const outlineId = crypto.randomUUID();
  db.exec(`
    INSERT INTO outlines (id, project_id, level, parent_id, target_ref_id, title, content, sort_order, created_at, updated_at)
    VALUES ('${outlineId}', '${projectId}', 0, NULL, NULL, '第一卷：灵徒之路', '主角林逸从山村出发，踏上修炼之路，结识同伴，初露锋芒。', 0, '${now}', '${now}');
    INSERT INTO outlines (id, project_id, level, parent_id, target_ref_id, title, content, sort_order, created_at, updated_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', 1, '${outlineId}', NULL, '第一章：山村少年', '林逸在山村中意外觉醒灵体，被路过的老者发现并收为弟子。', 0, '${now}', '${now}');
    INSERT INTO outlines (id, project_id, level, parent_id, target_ref_id, title, content, sort_order, created_at, updated_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', 1, '${outlineId}', NULL, '第二章：初入灵途', '跟随师父前往最近的城镇，见识灵修世界，第一次实战。', 1, '${now}', '${now}');
    INSERT INTO outlines (id, project_id, level, parent_id, target_ref_id, title, content, sort_order, created_at, updated_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', 1, '${outlineId}', NULL, '第三章：结识苏晴', '在灵修学院遇到天才少女苏晴，两人因一场误会结缘。', 2, '${now}', '${now}')
  `);

  // Chapters with content
  const chapters = [
    { id: crypto.randomUUID(), title: '第一章 山村少年', content: '<p>清晨的阳光穿过薄雾，洒在青石板路上。</p><p>林逸扛着柴火，从后山的小径走下来。十八岁的他身形修长，一双黑眸清澈如水，嘴角总挂着一丝懒洋洋的笑意。</p><p>"逸哥儿，你爷爷又在村口等你了！"隔壁王婶探出头来喊道。</p><p>林逸脚步一顿，露出一个苦笑。爷爷最近总说些奇怪的话，什么"灵气""觉醒"，听起来像是在说胡话。</p><p>然而他不知道，今天的村庄，将因一场意外而彻底改变。</p>' },
    { id: crypto.randomUUID(), title: '第二章 初入灵途', content: '<p>三天后，林逸站在了青云城的城门前。</p><p>这座城比他想象的要大得多。街道上人来人往，偶尔能看到身披法袍的灵修者御风而行，引得路人纷纷仰望。</p><p>"这就是灵修的世界……"林逸喃喃道，眼中闪烁着从未有过的光芒。</p><p>老者——现在他知道叫玄清真人——拍拍他的肩膀："别光看热闹，你的修炼才刚开始。"</p>' },
    { id: crypto.randomUUID(), title: '第三章 结识苏晴', content: '<p>灵修学院的演武场上，一场引人注目的对决正在进行。</p><p>林逸看着场中那个长发飘飘的少女，她手持冰蓝色法杖，每一击都带着刺骨的寒意。对手已经被逼到了角落，几乎无法还手。</p><p>"苏晴学姐又赢了！"观众席上传来一阵欢呼。</p><p>林逸不自觉地多看了两眼。就在这时，少女的目光恰好扫过来，两人视线交汇。</p><p>那双明亮的眸子里，带着一丝淡淡的好奇。</p><p>这是他们的第一次对视，却不是最后一次。</p>' },
  ];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!;
    const wordCount = ch.content.replace(/<[^>]+>/g, '').length;
    db.exec(`
      INSERT INTO chapters (id, project_id, volume_id, title, word_count, file_path, status, sort_order, created_at, updated_at)
      VALUES ('${ch.id}', '${projectId}', NULL, '${ch.title}', ${wordCount}, '${projectId}/chapters/${ch.id}.md', 'draft', ${i}, '${now}', '${now}')
    `);
  }

  // Foreshadowing
  db.exec(`
    INSERT INTO foreshadowing (id, project_id, title, description, status, importance, created_at, updated_at)
    VALUES ('${crypto.randomUUID()}', '${projectId}', '神秘老者的真实身份', '玄清真人对林逸的灵体似乎早有预判，他到底是谁？为什么选择林逸？', 'planted', 'important', '${now}', '${now}')
  `);

  logger.info({ projectId }, 'seeded example project');
}
