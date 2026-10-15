/** Web Crypto is available in Node 24, Workers and secure browser contexts. */
export function randomInt(max:number):number {
  if(!Number.isSafeInteger(max)||max<1||max>0xffffffff)throw Error('Invalid random range');
  const limit=0x100000000-(0x100000000%max);
  const sample=new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(sample); } while(sample[0]>=limit);
  return sample[0]%max;
}
export const randomUUID=()=>globalThis.crypto.randomUUID();
