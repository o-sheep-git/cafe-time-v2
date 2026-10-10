import { describe, expect, it } from 'vitest';
import { MENU, RANKS } from '../src/game/data';
import {
  availableMenus, decorForLevel, formatRemaining, levelForMenu, menusForLevel, nextRank, rankForPoints, rankProgress,
} from '../src/game/progress';

describe('常連度の定義', () => {
  it('レベルは1から連番で、必要ななじみは増えていく', () => {
    RANKS.forEach((r, i) => {
      expect(r.level).toBe(i + 1);
      if (i > 0) expect(r.points).toBeGreaterThan(RANKS[i - 1].points);
    });
    expect(RANKS[0].points).toBe(0);
  });
  it('すべてのメニューがどこかで解放される', () => {
    for (const m of MENU) expect(levelForMenu(m.id)).not.toBeNull();
    expect(levelForMenu('blend')).toBe(1);
  });
  it('解放するメニューは品書きにある', () => {
    for (const r of RANKS) {
      if (r.unlock.type === 'menu') expect(MENU.some((m) => m.id === (r.unlock as { id: string }).id)).toBe(true);
    }
  });
});

describe('常連度の計算', () => {
  it('なじみからレベルが決まる', () => {
    expect(rankForPoints(0).level).toBe(1);
    expect(rankForPoints(44).level).toBe(1);
    expect(rankForPoints(45).level).toBe(2);
    expect(rankForPoints(1e9).level).toBe(RANKS.length);
    expect(rankForPoints(-5).level).toBe(1);
  });
  it('次のレベルまでの進み具合', () => {
    const p = rankProgress(45 + (150 - 45) / 2);
    expect(p.rank.level).toBe(2);
    expect(p.next!.level).toBe(3);
    expect(p.fraction).toBeCloseTo(0.5);
    expect(p.remaining).toBeCloseTo(52.5);
  });
  it('最後のレベルでは次がない', () => {
    const p = rankProgress(999999);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
    expect(nextRank(999999)).toBeNull();
  });
});

describe('アンロック', () => {
  it('レベルに応じてメニューが増える', () => {
    expect(menusForLevel(1)).toEqual(['blend']);
    expect(menusForLevel(4)).toEqual(['blend', 'iced', 'tea']);
    expect(menusForLevel(15)).toHaveLength(MENU.length);
  });
  it('レベルに応じて店内が変わる', () => {
    expect(decorForLevel(2).size).toBe(0);
    expect([...decorForLevel(5)]).toEqual(['flower', 'books']);
    expect(decorForLevel(15).has('mymug')).toBe(true);
  });
  it('一度解放したメニューは、条件が変わっても残る', () => {
    expect(availableMenus(0, ['pudding'])).toEqual(['blend', 'pudding']);
    expect(availableMenus(0, ['unknown'])).toEqual(['blend']);
  });
});

describe('残り時間の目安', () => {
  it('ざっくりした表現になる', () => {
    expect(formatRemaining(0)).toBe('');
    expect(formatRemaining(3)).toBe('約5分');
    expect(formatRemaining(42)).toBe('約40分');
    expect(formatRemaining(125)).toBe('約2時間10分');
    expect(formatRemaining(118)).toBe('約2時間');
    expect(formatRemaining(179)).toBe('約3時間');
    expect(formatRemaining(1500)).toBe('約25時間');
  });
});
