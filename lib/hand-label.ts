const categories=['HIGH CARD','ONE PAIR','TWO PAIR','THREE OF A KIND','STRAIGHT','FLUSH','FULL HOUSE','FOUR OF A KIND','STRAIGHT FLUSH'];
function category(cards:string[]) {
  const ranks=cards.map(c=>'23456789TJQKA'.indexOf(c[0])+2).sort((a,b)=>b-a);
  const groups=Object.values(ranks.reduce<Record<number,number>>((a,r)=>{a[r]=(a[r]||0)+1;return a;},{})).sort((a,b)=>b-a);
  const flush=cards.length===5&&cards.every(c=>c[1]===cards[0][1]);
  const straight=cards.length===5&&new Set(ranks).size===5&&(ranks[0]-ranks[4]===4||ranks.join(',')==='14,5,4,3,2');
  return flush&&straight?8:groups[0]===4?7:groups[0]===3&&groups[1]===2?6:flush?5:straight?4:groups[0]===3?3:groups[0]===2&&groups[1]===2?2:groups[0]===2?1:0;
}
export function handLabel(input:(string|null)[]) {
  const cards=input.filter((c):c is string=>!!c&&/^[2-9TJQKA][cdhs]$/.test(c));
  if(cards.length<2)return 'WAITING';
  if(cards.length<5)return categories[category(cards)];
  let best=0;
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++)best=Math.max(best,category([cards[a],cards[b],cards[c],cards[d],cards[e]]));
  if(best===8&&[...'cdhs'].some(suit=>[...'TJQKA'].every(rank=>cards.includes(rank+suit))))return 'ROYAL FLUSH';
  return categories[best];
}
