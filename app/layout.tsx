import type { Metadata } from 'next';
import './globals.css';
import './casino-polish.css';
import './casino-portrait.css';
import './casino-green-felt.css';
import './tournaments.css';
export const metadata: Metadata={title:'Velora Poker — A seat at something extraordinary',description:'Original 3D social poker. Free virtual chips. Independent foundation preview.',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
