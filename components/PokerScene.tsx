'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TableView } from '../game/engine';
function CardMesh({ card, x, z, index }: {
    card: string | null;
    x: number;
    z: number;
    index: number;
}) {
    const ref = useRef<THREE.Group>(null);
    const born = useRef(0);
    const texture = useMemo(() => { const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 360; const c = canvas.getContext('2d')!; c.fillStyle = card ? '#fff8e8' : '#123c35'; c.fillRect(0, 0, 256, 360); c.strokeStyle = '#c4a363'; c.lineWidth = 8; c.strokeRect(12, 12, 232, 336); if (card) {
        const suit = { s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]];
        c.fillStyle = 'hd'.includes(card[1]) ? '#b63f4b' : '#172c2a';
        c.font = 'bold 62px Georgia';
        c.fillText(card[0] === 'T' ? '10' : card[0], 25, 80);
        c.font = '120px Georgia';
        c.textAlign = 'center';
        c.fillText(suit!, 128, 245);
    }
    else {
        c.fillStyle = '#c4a363';
        c.textAlign = 'center';
        c.font = '76px Georgia';
        c.fillText('V', 128, 210);
        for (let y = 40; y < 330; y += 30) {
            c.fillRect(28, y, 5, 5);
            c.fillRect(223, y, 5, 5);
        }
    } const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t; }, [card]);
    useEffect(() => () => texture.dispose(), [texture]);
    useFrame((s, delta) => { if (!ref.current)
        return; if (!born.current)
        born.current = s.clock.elapsedTime + index * .08; const progress = THREE.MathUtils.clamp((s.clock.elapsedTime - born.current) * 2, 0, 1); ref.current.position.x = THREE.MathUtils.lerp(0, x, progress); ref.current.position.z = THREE.MathUtils.lerp(-1, z, progress); ref.current.position.y = .37 + Math.sin(progress * Math.PI) * .5; ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, 0, 8, delta); });
    return <group ref={ref}><mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.55, .78]}/><meshStandardMaterial map={texture} roughness={.65} side={THREE.DoubleSide}/></mesh><mesh position={[0, -.009, 0]}><boxGeometry args={[.55, .015, .78]}/><meshStandardMaterial color="#e7e1cd"/></mesh></group>;
}
function ChipStack({ x, z, count = 5, color = '#b84d48' }: {
    x: number;
    z: number;
    count?: number;
    color?: string;
}) { return <group position={[x, .34, z]}>{Array.from({ length: Math.min(count, 12) }, (_, i) => <mesh key={i} position={[0, i * .045, 0]} castShadow><cylinderGeometry args={[.13, .13, .038, 24]}/><meshStandardMaterial color={i % 3 === 0 ? '#dfd2ab' : color} metalness={.15} roughness={.4}/></mesh>)}</group>; }
function Room({ table, quality, zoom }: {
    table: TableView | null;
    quality: string;
    zoom: number;
}) {
    const { camera, size } = useThree();
    useFrame((s, delta) => { const aspect = size.width / size.height; const d = aspect < 1.25 ? 1.28 : 1; camera.position.lerp(new THREE.Vector3(Math.sin(s.pointer.x * .15) * 2, 7.2 * d / zoom, 7.7 * d / zoom), Math.min(1, delta * 2)); camera.lookAt(0, 0, 0); });
    return <><color attach="background" args={['#081411']}/><fog attach="fog" args={['#081411', 15, 35]}/><ambientLight intensity={.7}/><hemisphereLight args={['#b2d5c7', '#15100b', 1]}/><spotLight position={[0, 8, 2]} intensity={95} angle={.8} penumbra={1} castShadow={quality === 'high'} shadow-mapSize={[1024, 1024]}/><pointLight position={[-5, 3, -3]} color="#daa95e" intensity={14}/><pointLight position={[5, 2, 3]} color="#4dbf9d" intensity={18}/>
 <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]} receiveShadow><planeGeometry args={[60, 60]}/><meshStandardMaterial color="#101914" roughness={.5}/></mesh>
 {[[-2.1, 0], [2.1, 0]].map(([x, z], i) => <mesh key={i} position={[x, -.6, z]}><cylinderGeometry args={[.18, .35, 1.4, 24]}/><meshStandardMaterial color="#6e583b" metalness={.7} roughness={.3}/></mesh>)}
 <group scale={[1.65, 1, 1]}><mesh position={[0, .1, 0]} castShadow><cylinderGeometry args={[2.5, 2.45, .38, 80]}/><meshStandardMaterial color="#32231b" roughness={.4}/></mesh><mesh position={[0, .26, 0]}><cylinderGeometry args={[2.48, 2.48, .1, 80]}/><meshStandardMaterial color="#b5965e" metalness={.6} roughness={.3}/></mesh><mesh position={[0, .33, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.25, .19, 12, 80]}/><meshStandardMaterial color="#18221d" roughness={.55}/></mesh><mesh position={[0, .31, 0]} receiveShadow><cylinderGeometry args={[2.23, 2.23, .04, 80]}/><meshStandardMaterial color="#146851" roughness={1}/></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .337, 0]}><ringGeometry args={[1.83, 1.845, 80]}/><meshStandardMaterial color="#79aa88" transparent opacity={.3}/></mesh></group>
 {Array.from({ length: table?.capacity || 6 }, (_, i) => { const angle = i / (table?.capacity || 6) * Math.PI * 2; const x = Math.sin(angle) * 4.45, z = Math.cos(angle) * 2.85; return <group key={i} position={[x, -.15, z]} rotation={[0, angle, 0]}><mesh castShadow><boxGeometry args={[.9, .2, .85]}/><meshStandardMaterial color="#17231e" roughness={.7}/></mesh><mesh position={[0, .42, .4]}><boxGeometry args={[.95, .8, .18]}/><meshStandardMaterial color="#24342a" roughness={.75}/></mesh><mesh position={[0, -.6, 0]}><cylinderGeometry args={[.08, .12, .8, 12]}/><meshStandardMaterial color="#a48753" metalness={.8}/></mesh></group>; })}
 {(table?.board || []).map((c, i) => <CardMesh key={`${table?.handId}-${i}`} card={c} x={(i - 2) * .65} z={0} index={i}/>)}
 {!table && <><CardMesh card={null} x={-.32} z={.1} index={0}/><CardMesh card={null} x={.32} z={.1} index={1}/><ChipStack x={1.15} z={.3}/><ChipStack x={1.5} z={.35} count={8} color="#263e98"/></>}
 {table?.seats.map((p, i) => { const angle = i / table.capacity * Math.PI * 2; return <group key={p.id}><ChipStack x={Math.sin(angle) * 2.85} z={Math.cos(angle) * 1.65} count={Math.max(1, Math.ceil(p.stack / 200))} color={i % 2 ? '#c8a24f' : '#b84d48'}/>{!p.folded && p.cards.map((c, k) => <CardMesh key={`${table.handId}-${p.id}-${k}`} card={c} x={Math.sin(angle) * 2.6 + (k - .5) * .6} z={Math.cos(angle) * 1.4} index={i * 2 + k}/>)}</group>; })}
 {!!table?.pot && <ChipStack x={0} z={-.85} count={Math.ceil(table.pot / 50)} color="#b89652"/>}
 </>;
}
export default function PokerScene({ table = null, quality = 'high', zoom = 1 }: {
    table?: TableView | null;
    quality?: string;
    zoom?: number;
}) { return <Canvas camera={{ position: [0, 8, 8], fov: 43 }} dpr={quality === 'low' ? 1 : [1, 1.5]} shadows={quality === 'high'} gl={{ antialias: quality === 'high', powerPreference: quality === 'low' ? 'low-power' : 'high-performance' }} fallback={<div className="scene-fallback">3D is unavailable. Switch to 2D table view to play.</div>}><Room table={table} quality={quality} zoom={zoom}/></Canvas>; }
