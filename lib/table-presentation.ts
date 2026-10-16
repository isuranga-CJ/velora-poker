import { score5, type TableView } from '../game/engine.ts';
import { handLabel } from './hand-label.ts';

export function winnerHandLabel(table: TableView, playerId: string): string | null {
  if (table.phase !== 'complete' || !(table.payouts[playerId] > 0)) return null;
  const player = table.seats.find(p => p.id === playerId);
  if (!player || player.folded) return null;
  if (table.seats.filter(p => !p.folded).length === 1) return 'WON BY FOLD';
  // Never infer a rank from the board when this player's private cards are hidden.
  if (table.board.length !== 5 || player.cards.length !== 2 || player.cards.some(c => !c)) return 'HAND NOT SHOWN';
  return handLabel([...player.cards, ...table.board]);
}

/** Uses only cards already visible to this viewer. */
export function bestVisibleFive(input: (string | null)[]): string[] {
  const cards = input.filter((c): c is string => !!c && /^[2-9TJQKA][cdhs]$/.test(c));
  if (cards.length < 5 || cards.length > 7 || new Set(cards).size !== cards.length) return [];
  let best = -1;
  let selected: string[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const score = score5(five);
            if (score > best) { best = score; selected = five; }
          }
  return selected;
}

export function collectedBets(before: TableView | null, after: TableView | null): string[] {
  if (!before || !after || before.id !== after.id || before.handId !== after.handId || !after.handId) return [];
  if (before.phase === after.phase || before.phase === 'complete' || after.phase === 'complete') return [];
  return before.seats.filter(p => p.bet > 0).map(p => p.id);
}

export function latestAction(table: TableView) {
  const match = table.history.at(-1)?.match(/^(.+): (fold|check|call|raise)(?: (\d+))?$/);
  if (!match) return null;
  const [, name, move, amount] = match;
  return { name, move, label: move === 'raise' ? `RAISE ${Number(amount || 0).toLocaleString()}` : move.toUpperCase() };
}
