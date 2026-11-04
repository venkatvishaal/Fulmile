// Shared clay-model pieces for every Fulmile WebGL scene (landing yard, auth checkpoint/stack).
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Read the design tokens so the scene always matches index.css.
export const token = (name) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return `rgb(${v.split(/\s+/).join(',')})`;
};

export const palette = () => ({
  ink: token('ink'), paper: token('paper'), surface: token('surface'), line: token('line'), muted: token('muted'),
  signal: token('signal'), transit: token('transit'), ok: token('ok'), warn: token('warn'), danger: token('danger'),
});

const TRAILER_LEN = 1.7;
const BOOKED = 0.64; // 3,200 of 5,000 kg, mirrors the waybill card

export function Box({ size, position, color, ...rest }) {
  return (
    <mesh position={position} castShadow receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export function Edges({ size, position, color, opacity = 1 }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  return (
    <lineSegments position={position} geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

const WHEELS = [[-0.3, -0.8], [0.3, -0.8], [-0.3, -0.35], [0.3, -0.35], [-0.3, 0.85], [0.3, 0.85]];

export function Truck({ groupRef, c, hero = false }) {
  const trailerZ = -0.25;
  const bookedLen = TRAILER_LEN * BOOKED;
  const spareLen = TRAILER_LEN - bookedLen;
  const rear = trailerZ - TRAILER_LEN / 2;
  return (
    <group ref={groupRef}>
      <group scale={0.9}>
        <Box size={[0.5, 0.12, 2.45]} position={[0, 0.2, 0]} color={c.ink} />
        <Box size={[0.64, 0.56, 0.56]} position={[0, 0.5, 0.9]} color={hero ? c.ink : c.muted} />
        <Box size={[0.6, 0.16, 0.04]} position={[0, 0.62, 1.18]} color={c.line} />
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.32, 1.19]}>
            <boxGeometry args={[0.1, 0.06, 0.02]} />
            <meshBasicMaterial color="#FFF6DC" />
          </mesh>
        ))}
        {WHEELS.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.15, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.1, 12]} />
            <meshStandardMaterial color={c.ink} roughness={1} />
          </mesh>
        ))}
        {hero ? (
          <group position={[0, 0.6, 0]}>
            {/* Glass trailer: booked crates at the back, amber spare volume at the front. */}
            <mesh position={[0, 0, trailerZ]}>
              <boxGeometry args={[0.64, 0.64, TRAILER_LEN]} />
              <meshStandardMaterial color={c.surface} transparent opacity={0.22} depthWrite={false} />
            </mesh>
            <Edges size={[0.64, 0.64, TRAILER_LEN]} position={[0, 0, trailerZ]} color={c.ink} opacity={0.7} />
            {[0, 1, 2].flatMap((i) => [0, 1].flatMap((row) => [-1, 1].map((side) => (
              <Box
                key={`${i}${row}${side}`}
                size={[0.27, 0.27, bookedLen / 3 - 0.05]}
                position={[side * 0.15, -0.15 + row * 0.3, rear + (bookedLen / 3) * (i + 0.5)]}
                color={row ? c.transit : c.ink}
              />
            ))))}
            <mesh position={[0, 0, rear + bookedLen + spareLen / 2]}>
              <boxGeometry args={[0.56, 0.56, spareLen - 0.06]} />
              <meshBasicMaterial color={c.signal} transparent opacity={0.28} depthWrite={false} />
            </mesh>
            <Edges size={[0.56, 0.56, spareLen - 0.06]} position={[0, 0, rear + bookedLen + spareLen / 2]} color={c.signal} />
          </group>
        ) : (
          <Box size={[0.64, 0.64, TRAILER_LEN]} position={[0, 0.6, trailerZ]} color={c.surface} />
        )}
      </group>
    </group>
  );
}

// Soft radial sprite used as cheap bloom (lamps, pings, arc heads). One texture shared by every Glow.
let glowTexture;
const getGlowTexture = () => {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
};

export function Glow({ color, size = 1, opacity = 0.9, additive = true, spriteRef, materialRef, ...rest }) {
  const map = useMemo(getGlowTexture, []);
  return (
    <sprite ref={spriteRef} scale={[size, size, size]} {...rest}>
      <spriteMaterial ref={materialRef} map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </sprite>
  );
}

// Damped spring step for drop-in parts; mutates and returns state { y, v }.
// Fixed 1/60s substeps keep it stable and real-time at any frame rate (capped at 0.5s of catch-up).
export function springStep(s, target, dt, stiffness = 70, damping = 7) {
  let left = Math.min(dt, 0.5);
  while (left > 0) {
    const step = Math.min(left, 1 / 60);
    s.v += (target - s.y) * stiffness * step;
    s.v *= Math.exp(-damping * step);
    s.y += s.v * step;
    left -= step;
  }
  return s;
}

export const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

// Drag-to-orbit on desktop (no zoom/pan, so page scroll is untouched); a gentle auto-orbit on touch.
// followRef (optional): keep the orbit centred on a moving object by sliding target and camera together.
export function OrbitRig({ reduceMotion, radius = 19, target = [0, 0, 0], azimuth = 0.7, followRef }) {
  const { camera, gl, size } = useThree();
  const controls = useRef(null);
  const touch = useMemo(coarsePointer, []);
  const az = useRef(azimuth);
  const centre = useRef(new THREE.Vector3(...target));
  const want = useMemo(() => new THREE.Vector3(), []);
  const shift = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const r = radius * Math.max(1, 1.6 / (size.width / size.height));
    camera.clearViewOffset();
    const [tx, ty, tz] = target;
    camera.position.set(tx + Math.sin(az.current) * r, ty + r * 0.62, tz + Math.cos(az.current) * r);
    camera.lookAt(tx, ty, tz);
    if (touch) return undefined;
    const c = new OrbitControls(camera, gl.domElement);
    c.target.set(tx, ty, tz);
    c.enableZoom = false;
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minPolarAngle = 0.45;
    c.maxPolarAngle = 1.15;
    c.autoRotate = !reduceMotion;
    c.autoRotateSpeed = 0.6;
    const stopAuto = () => { c.autoRotate = false; };
    c.addEventListener('start', stopAuto);
    controls.current = c;
    return () => { c.removeEventListener('start', stopAuto); c.dispose(); controls.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target is a literal array; its values are what matter
  }, [camera, gl, size.width, size.height, touch, reduceMotion, radius, target[0], target[1], target[2]]);

  useFrame((_, dt) => {
    if (followRef?.current) {
      followRef.current.getWorldPosition(want).add(shift.set(target[0], target[1], target[2]));
      shift.copy(want).sub(centre.current).multiplyScalar(1 - Math.exp(-dt * 2.5));
      centre.current.add(shift);
      camera.position.add(shift);
      if (controls.current) controls.current.target.copy(centre.current);
    }
    if (controls.current) { controls.current.update(); return; }
    if (reduceMotion) { camera.lookAt(centre.current); return; }
    az.current += dt * 0.08;
    const { x: tx, y: ty, z: tz } = followRef ? centre.current : { x: target[0], y: target[1], z: target[2] };
    const flat = Math.hypot(camera.position.x - tx, camera.position.z - tz);
    camera.position.set(tx + Math.sin(az.current) * flat, camera.position.y, tz + Math.cos(az.current) * flat);
    camera.lookAt(tx, ty, tz);
  });
  return null;
}

