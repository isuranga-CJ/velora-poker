export function GET(){return Response.json({status:'ok',service:'velora-web',milestone:'foundation',gameServerConfigured:!!process.env.NEXT_PUBLIC_GAME_URL});}
