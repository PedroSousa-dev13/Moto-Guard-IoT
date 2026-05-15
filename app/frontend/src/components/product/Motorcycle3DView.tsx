import React, { Suspense, useMemo, useRef } from 'react';
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

// ── Câmara fixa em 3ª pessoa ──────────────────────────────────────────
function FollowCamera() {
  useFrame(({ camera }) => {
    const offset = new THREE.Vector3(0, 3, 8);
    const desired = new THREE.Vector3(0, 0, 0).add(offset);
    camera.position.lerp(desired, 0.06);
    camera.lookAt(0, 0, 0);
  }, -1);

  return null;
}

// ── Modelo 3D ──────────────────────────────────────────────────────────
function Model({ roll, pitch, yaw, speed, rpm, engineTempStatus, modelColor }: Motorcycle3DViewProps) {
  const fbx = useFBX('/motorcycle.fbx');
  const groupRef = useRef<THREE.Group>(null);
  const smoothRoll = useRef(roll);
  const smoothPitch = useRef(pitch);
  const smoothYaw = useRef(yaw);
  const vibPhase = useRef(0);
  const wheelsRef = useRef<THREE.Object3D[]>([]);

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

  useFrame((state, delta) => {
    if (!groupRef.current) return;

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

    groupRef.current.position.set(0, 0, 0);
    for (const w of wheelsRef.current) w.rotation.x += (speed * delta) / 5;
    if (rpm > 1000) {
      vibPhase.current += delta * 50;
      groupRef.current.position.y += Math.sin(vibPhase.current) * (rpm / 15000) * 0.02;
    }
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  );
}

export default function Motorcycle3DView(props: Motorcycle3DViewProps) {
  return (
    <div className="three-canvas-container" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <PerspectiveCamera makeDefault position={[0, 3, 8]} fov={35} />
        <Suspense fallback={null}>
          <Environment preset="night" />
          <ambientLight intensity={0.3} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow color="#4466ff" />
          <pointLight position={[-10, 5, -10]} intensity={1} color="#ff4444" />
          <directionalLight position={[0, 10, 0]} intensity={0.5} />
          <Model {...props} />
          <FollowCamera />
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4} resolution={1024} />
        </Suspense>
      </Canvas>
    </div>
  );
}
