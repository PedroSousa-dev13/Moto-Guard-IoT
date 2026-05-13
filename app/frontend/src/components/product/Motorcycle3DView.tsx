import React, { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Motorcycle3DViewProps {
  roll: number;
  pitch: number;
  yaw: number;
  speed: number;
  rpm: number;
  engineTempStatus: 'ok' | 'warning' | 'critical';
  lat?: number;
  lng?: number;
  originLat?: number;
  originLng?: number;
  hasMapOrigin?: boolean;
  modelColor?: string;
}

const GPS_SCALE = 0.004;
const MAX_TRAIL = 5000;

function gpsToScene(lat: number, lng: number, originLat: number, originLng: number): THREE.Vector3 {
  const r = THREE.MathUtils.degToRad(originLat);
  const m = 111319 * Math.cos(r);
  return new THREE.Vector3((lng - originLng) * m * GPS_SCALE, 0, -((lat - originLat) * 111319 * GPS_SCALE));
}

// ── Gera textura de mapa procedural (gratuita, sem API) ──────────────
function buildMapTexture(): THREE.CanvasTexture {
  const W = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = W;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#0a0a12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, W);

  // Manchas de terreno
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(40,45,65,${0.03 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * W, 2 + Math.random() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Estradas
  for (let layer = 0; layer < 2; layer++) {
    const isMain = layer === 0;
    ctx.strokeStyle = isMain ? 'rgba(60,65,85,0.25)' : 'rgba(45,50,70,0.12)';
    ctx.lineWidth = isMain ? 4 : 1.5;
    const count = isMain ? 14 : 40;
    const step = isMain ? 75 : 26;
    for (let i = 0; i < count; i++) {
      const p = i * step + (isMain ? 15 : 5 + Math.random() * 10);
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    }
  }

  // Rotundas / nós
  for (let i = 0; i < 20; i++) {
    ctx.strokeStyle = 'rgba(60,65,85,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * W, 6 + Math.random() * 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.5, 1.5);
  return t;
}

// ── Câmara em terceira pessoa (atrás da mota) ─────────────────────────
function FollowCamera({ target, yaw, active }: { target: THREE.Vector3; yaw: number; active: boolean }) {
  const smoothYaw = useRef(yaw);

  useFrame(({ camera }) => {
    if (!active) return;
    // Suaviza o yaw para evitar saltos na câmara
    let diff = yaw - smoothYaw.current;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    smoothYaw.current += diff * 0.06;

    const yawRad = THREE.MathUtils.degToRad(smoothYaw.current);
    // Direção "trás" da mota no sistema de cena
    const behind = new THREE.Vector3(-Math.sin(yawRad), 0, Math.cos(yawRad));
    const desired = target.clone().add(behind.multiplyScalar(5)).add(new THREE.Vector3(0, 3, 0));
    camera.position.lerp(desired, 0.06);
    camera.lookAt(target);
  }, -1);

  return null;
}

// ── Modelo 3D ──────────────────────────────────────────────────────────
function Model({
  roll, pitch, yaw, speed, rpm, engineTempStatus,
  lat, lng, originLat, originLng, hasMapOrigin, modelColor,
}: Motorcycle3DViewProps) {
  const fbx = useFBX('/motorcycle.fbx');
  const groupRef = useRef<THREE.Group>(null);
  const smoothRoll = useRef(roll);
  const smoothPitch = useRef(pitch);
  const smoothYaw = useRef(yaw);
  const trailRef = useRef<THREE.BufferGeometry>(new THREE.BufferGeometry());
  const trailPos = useRef<number[]>([]);
  const trailSkip = useRef(0);
  const lastPt = useRef<THREE.Vector3 | null>(null);
  const vibPhase = useRef(0);
  const wheelsRef = useRef<THREE.Object3D[]>([]);
  const groundTex = useMemo(() => buildMapTexture(), []);

  const model = useMemo(() => {
    const c = fbx.clone();
    const box = new THREE.Box3().setFromObject(c);
    const s = 3 / Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    c.scale.setScalar(s);
    c.position.y = -box.min.y * s;
    wheelsRef.current = [];
    c.traverse((child) => {
      const n = child.name.toLowerCase();
      if (n.includes('wheel') || n.includes('tire') || n.includes('rim')) wheelsRef.current.push(child);
      if (modelColor && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && !['wheel', 'tire', 'rim', 'engine', 'motor'].some(k => n.includes(k)))
          mat.color = new THREE.Color(modelColor);
      }
    });
    return c;
  }, [fbx, modelColor]);

  useMemo(() => {
    model.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const n = child.name.toLowerCase();
      if (!n.includes('engine') && !n.includes('motor')) return;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (engineTempStatus === 'critical') { mat.emissive = new THREE.Color(0xff4444); mat.emissiveIntensity = 2; }
      else if (engineTempStatus === 'warning') { mat.emissive = new THREE.Color(0xffbb33); mat.emissiveIntensity = 1; }
      else { mat.emissive = new THREE.Color(0x000000); }
    });
  }, [model, engineTempStatus]);

  const scenePos = useMemo(() => {
    if (!hasMapOrigin || lat == null || lng == null || originLat == null || originLng == null)
      return new THREE.Vector3(0, 0, 0);
    return gpsToScene(lat, lng, originLat, originLng);
  }, [lat, lng, originLat, originLng, hasMapOrigin]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Suaviza a rotação da mota (lerp)
    const lerpFactor = 1 - Math.pow(0.001, delta);
    smoothRoll.current += (roll - smoothRoll.current) * lerpFactor;
    smoothPitch.current += (pitch - smoothPitch.current) * lerpFactor;
    let yawDiff = yaw - smoothYaw.current;
    if (yawDiff > 180) yawDiff -= 360;
    else if (yawDiff < -180) yawDiff += 360;
    smoothYaw.current += yawDiff * lerpFactor;

    groupRef.current.rotation.set(
      THREE.MathUtils.degToRad(smoothPitch.current),
      THREE.MathUtils.degToRad(smoothYaw.current + 180),
      THREE.MathUtils.degToRad(-smoothRoll.current),
    );

    groupRef.current.position.copy(scenePos);
    for (const w of wheelsRef.current) w.rotation.x += (speed * delta) / 5;
    if (rpm > 1000) {
      vibPhase.current += delta * 50;
      groupRef.current.position.y += Math.sin(vibPhase.current) * (rpm / 15000) * 0.02;
    }
    trailSkip.current++;
    if (!hasMapOrigin || trailSkip.current % 3 !== 0) return;
    const pt = new THREE.Vector3(scenePos.x, 0.02, scenePos.z);
    if (lastPt.current && lastPt.current.distanceTo(pt) < 0.02) return;
    lastPt.current = pt;
    trailPos.current.push(pt.x, pt.y, pt.z);
    if (trailPos.current.length > MAX_TRAIL * 3) trailPos.current.splice(0, 3);
    const arr = new Float32Array(trailPos.current);
    trailRef.current.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    trailRef.current.setDrawRange(0, trailPos.current.length / 3);
  });

  return (
    <group>
      <group ref={groupRef} name="bike" rotation={[
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw + 180),
        THREE.MathUtils.degToRad(-roll),
      ]}>
        <primitive object={model} />
      </group>

      {trailPos.current.length > 3 && (
        <line>
          <bufferGeometry ref={trailRef} />
          <lineBasicMaterial color={modelColor ?? '#33b5e5'} transparent opacity={0.6} />
        </line>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scenePos.x, -0.01, scenePos.z]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial map={groundTex} roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  );
}

export default function Motorcycle3DView(props: Motorcycle3DViewProps) {
  const hasLiveGPS = !!(props.hasMapOrigin && props.lat != null && props.lng != null);
  const target = useMemo(() => {
    if (!hasLiveGPS || props.originLat == null || props.originLng == null) return new THREE.Vector3(0, 0, 0);
    return gpsToScene(props.lat!, props.lng!, props.originLat, props.originLng);
  }, [props.lat, props.lng, props.originLat, props.originLng, props.hasMapOrigin]);

  return (
    <div className="three-canvas-container" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <PerspectiveCamera makeDefault position={[6, 3, 6]} fov={35} />
        <Suspense fallback={null}>
          <Environment preset="night" />
          <ambientLight intensity={0.3} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow color="#4466ff" />
          <pointLight position={[-10, 5, -10]} intensity={1} color="#ff4444" />
          <directionalLight position={[0, 10, 0]} intensity={0.5} />
          <Model {...props} />
          <FollowCamera target={target} yaw={props.yaw} active={hasLiveGPS} />
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4} resolution={1024} />
        </Suspense>
      </Canvas>
    </div>
  );
}
