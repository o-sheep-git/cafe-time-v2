/**
 * ドット絵のスプライト。1文字が1ドットで、'.' は透明。
 * 画像に差し替えたいときは src/scene/overrides.ts に同じ id で画像のパスを書く。
 */

export interface Sprite {
  w: number;
  h: number;
  rows: string[];
  pal: Record<string, string>;
}

function sprite(pal: Record<string, string>, rows: string[]): Sprite {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, '.')), pal };
}

const CHINA = { w: '#f6eddc', s: '#d9c9ac', p: '#efe3ca', q: '#c4b08e' };

const cup = (liquid: string, extra: Record<string, string> = {}) =>
  sprite({ ...CHINA, k: liquid, ...extra }, [
    '.....wwwwwwwwww.....',
    '....wkkkkkkkkkkw....',
    '....wwkkkkkkkkww.ww.',
    '....wwwwwwwwwwwww.w.',
    '....wwwwwwwwwwww..w.',
    '....swwwwwwwwwwwww..',
    '.....wwwwwwwwwws....',
    '.....swwwwwwwws.....',
    '..pppsswwwwwwsspp...',
    '.pppppssssssspppppp.',
    'pppppppppppppppppppp',
    '.qppppppppppppppppq.',
    '...qqqqqqqqqqqqqq...',
  ]);

const blend = cup('#4a2c1c');

/** 自分用のカップ（常連度が上がりきると出てくる） */
const mymug = sprite({ m: '#5d7a8c', d: '#465e6e', l: '#7f9aaa', k: '#4a2c1c', c: '#8c5a3a', e: '#6e452e' }, [
  '...mmmmmmmmmm.....',
  '..mkkkkkkkkkkm....',
  '..mmkkkkkkkkmm.mm.',
  '..lmmmmmmmmmmmm.m.',
  '..lmmmmmmmmmmm..m.',
  '..lmmmmmmmmmmm..m.',
  '..lmmmmmmmmmmmmm..',
  '..lmmmmmmmmmmd....',
  '..dmmmmmmmmmmd....',
  '...dmmmmmmmmd.....',
  '.cccddddddddccc...',
  'cccccccccccccccc..',
  '.eeeeeeeeeeeeee...',
]);

const iced = sprite({ g: '#e4ecea', h: '#ffffff', k: '#40271a', i: '#96745a', j: '#6b4a34', r: '#c9523c', t: '#f2e6d2', c: '#8c5a3a', e: '#6e452e' }, [
  '.........rr...',
  '........rt....',
  '........rr....',
  '..gggggrtgggg.',
  '..gkkkkrrkkkg.',
  '..hkiikkkkjkg.',
  '..hkiikkiikkg.',
  '..hkkkkkiikkg.',
  '..hkkiikkkkkg.',
  '..hkkiikkjkkg.',
  '..hkkkkkkkkkg.',
  '..gkjkkkiikkg.',
  '...gkkkkiikg..',
  '...gkkkkkkkg..',
  '...gkkkkkkkg..',
  '...ggggggggg..',
  '.cccccccccccc.',
  '..eeeeeeeeee..',
]);

const tea = sprite({ ...CHINA, k: '#b8651e', a: '#d4883a', b: '#8a9a6a', y: '#e8c86a' }, [
  '....bb..................',
  '...wwww.................',
  '..wwwwww...w............',
  '.wwwwwwww.ww............',
  'wwwwwwwwwww...wwwwwwww..',
  'wbbwwwwwww...wkkaakkkw..',
  'wwwwwwwwww...wwkkkkww.w.',
  'swwwwwwwws...wwwwwwwwww.',
  '.swwwwwws....swwwwwww...',
  '..ssssss......swwwwws...',
  '............ppsswwssppy.',
  '...........pppppppppyyyp',
  '............qppppppppyq.',
  '..............qqqqqqq...',
]);

const jelly = sprite({ g: '#e4ecea', h: '#ffffff', k: '#2e1c14', j: '#5e3d2a', w: '#f8f0de', s: '#e2d4b8', r: '#c0392b', c: '#8c5a3a' }, [
  '.......r........',
  '......wwww......',
  '....wwwwwwws....',
  '..hkkwwwwwskkg..',
  '..hkkkkssskkkg..',
  '..hkjkkkjkkjkg..',
  '..hkkkjkkkkkkg..',
  '...gkkkkkjkkg...',
  '....gkjkkkkg....',
  '.....gggggg.....',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.....gggggg.....',
  '....hggggggg....',
]);

const cheesecake = sprite({ ...CHINA, t: '#c98a3c', u: '#dfa650', y: '#f4dc9c', o: '#e6c880', b: '#a06c3c', f: '#b8b8b0', d: '#8e8e88' }, [
  '..........ttttt.........',
  '.......ttttuuuttt.......',
  '.....tttuuuuuuuuttt.....',
  '....yyttttuuuuttttoo....',
  '....yyyyyyttttoooooo....',
  '....yyyyyyyyyooooooo....',
  '....yyyyyyyyyooooooo..f.',
  '....bbbbbbbbbbbbbbbb.ff.',
  '..ppppppppppppppppppfdpp',
  '.ppppppppppppppppppfdppp',
  'pppppppppppppppppppdpppp',
  '.qppppppppppppppppppppq.',
  '...qqqqqqqqqqqqqqqqqq...',
]);

const pudding = sprite({ ...CHINA, k: '#7a4420', c: '#9a5a2a', y: '#f2d272', o: '#dcb654', h: '#f8e49a', r: '#c0392b', x: '#f8f0de' }, [
  '..........r.........',
  '.........xxx........',
  '.......kkxxxkk......',
  '......kkkkkkkkk.....',
  '......hyyyyyyyo.....',
  '.....hyyyyyyyyoo....',
  '.....hyyyyyyyyoo....',
  '....hyyyyyyyyyyoo...',
  '....hyyyyyyyyyyoo...',
  '..pcchyyyyyyyyyoccp.',
  '.ppccccccccccccccppp',
  'pppppccccccccccppppp',
  '.qppppppppppppppppq.',
  '...qqqqqqqqqqqqqq...',
]);

const water = sprite({ g: '#e4ecea', h: '#ffffff', b: '#b4d2dc', l: '#cfe4ea' }, [
  'ggggggg',
  'h.....g',
  'h.....g',
  'hlllllg',
  'hbbbbbg',
  'hbbbbbg',
  'hbbbbbg',
  '.gbbbg.',
  '.ggggg.',
]);

const menucard = sprite({ p: '#f1e4c6', s: '#d4c19a', k: '#6e452e', r: '#b5523a', b: '#8c5a3a' }, [
  '.pppppppp.',
  '.prrrrrrp.',
  '.pppppppp.',
  '.pkkkkkkp.',
  '.pppppppp.',
  '.pkkkkppp.',
  '.pppppppp.',
  '.pkkkkkpp.',
  '.pppppppp.',
  '.ssssssss.',
  'bbbbbbbbbb',
]);

const reserved = sprite({ p: '#f1e4c6', s: '#d4c19a', k: '#6e452e', g: '#b8963c' }, [
  '..gggggggg..',
  '.pppppppppp.',
  '.pkkpkkpkkp.',
  '.pppppppppp.',
  '.pkkkkkkkpp.',
  'ssssssssssss',
]);

const CAT = { k: '#3b302c', e: '#e8c86a', n: '#2a211e' };

const catWalkA = sprite(CAT, [
  'k...........k.k.',
  'k...........kkk.',
  'k..........kkekk',
  '.k.kkkkkkkkkkkkk',
  '.kkkkkkkkkkkkkk.',
  '..kkkkkkkkkkkk..',
  '..kkkkkkkkkkk...',
  '..kk.k....kk.k..',
  '..k..k....k..k..',
]);

const catWalkB = sprite(CAT, [
  '............k.k.',
  'kk..........kkk.',
  '..k........kkekk',
  '..kkkkkkkkkkkkkk',
  '.kkkkkkkkkkkkkk.',
  '..kkkkkkkkkkkk..',
  '..kkkkkkkkkkk...',
  '...kkk....kkk...',
  '....k.k....k.k..',
]);

const catSit = sprite(CAT, [
  '..k...k....',
  '..kk.kk....',
  '..kkkkk....',
  '..kekek....',
  '..kkkkk....',
  '.kkkkkkk...',
  '.kkkkkkk...',
  'kkkkkkkkk..',
  'kkkkkkkkk.k',
  'kkkkkkkkkkk',
]);

const catSitB = sprite(CAT, [
  '..k...k....',
  '..kk.kk....',
  '..kkkkk....',
  '..kkkkk....',
  '..kkkkk....',
  '.kkkkkkk...',
  '.kkkkkkk...',
  'kkkkkkkkk.k',
  'kkkkkkkkk.k',
  'kkkkkkkkkkk',
]);

const BIRD = { b: '#8a6a4c', w: '#e8dcc4', o: '#d98a3a', k: '#2a211e' };

const birdA = sprite(BIRD, [
  '..bbb..',
  '.bbkbo.',
  'bbbbb..',
  'bbwww..',
  '.bwww..',
  '..k.k..',
]);

const birdB = sprite(BIRD, [
  '.......',
  '..bbb..',
  'bbbkbo.',
  'bbbwww.',
  '.bwww..',
  '..k.k..',
]);

const umbrella = sprite({ r: '#b5523a', d: '#8e3c2a', l: '#cf6e54', k: '#3b302c' }, [
  '.......k.......',
  '.....rrrrr.....',
  '...rrlrrrdrr...',
  '..rrlrrrrrdrr..',
  '.rrlrrrrrrrdrr.',
  'rrlrrrrrrrrrdrr',
  'r.r..r.k.r..r.r',
  '.......k.......',
  '.......k.......',
]);

export const SPRITES = {
  'menu.blend': blend,
  'menu.blend.mymug': mymug,
  'menu.iced': iced,
  'menu.tea': tea,
  'menu.jelly': jelly,
  'menu.cheesecake': cheesecake,
  'menu.pudding': pudding,
  'table.water': water,
  'table.menucard': menucard,
  'table.reserved': reserved,
  'event.cat.a': catWalkA,
  'event.cat.b': catWalkB,
  'event.catsit.a': catSit,
  'event.catsit.b': catSitB,
  'event.bird.a': birdA,
  'event.bird.b': birdB,
  'event.umbrella': umbrella,
} satisfies Record<string, Sprite>;

export type SpriteId = keyof typeof SPRITES;

export function menuSpriteId(menuId: string, mymugUnlocked = false): SpriteId {
  if (menuId === 'blend' && mymugUnlocked) return 'menu.blend.mymug';
  const id = `menu.${menuId}`;
  return (id in SPRITES ? id : 'menu.blend') as SpriteId;
}

/** 湯気の出る位置（スプライト左上からのオフセット） */
export const STEAM_AT: Partial<Record<SpriteId, [number, number]>> = {
  'menu.blend': [10, 0],
  'menu.blend.mymug': [8, 0],
  'menu.tea': [18, 3],
};
