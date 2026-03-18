import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useFBX, OrbitControls, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Motorcycle3DViewProps {
  roll: number;
  pitch: number;
  yaw: number;
  speed: number;
  rpm: number;
  engineTempStatus: 'ok' | 'warning' | 'critical';
}

function Model({ roll, pitch, yaw, speed, rpm, engineTempStatus }: Motorcycle3DViewProps) {
  const fbx = useFBX('/motorcycle.fbx');
  const wheelsRef = useRef<THREE.Object3D[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // Clone e escala do modelo
  const model = useMemo(() => {
    const clone = fbx.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    clone.scale.setScalar(scale);
    clone.position.y = -box.min.y * scale;

    // Identificar rodas e motor
    clone.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes('wheel') || name.includes('tire') || name.includes('rim')) {
        wheelsRef.current.push(child);
      }
    });
    
    return clone;
  }, [fbx]);

  // Animação contínua (Rodas e Vibração)
  useFrame((state, delta) => {
    // Rodar as rodas com base na velocidade
    const rotationSpeed = (speed * delta) / 5; // Ajuste de escala visual
    wheelsRef.current.forEach((wheel) => {
      wheel.rotation.x += rotationSpeed;
    });

    // Vibração do motor baseada em RPM
    if (groupRef.current && rpm > 1000) {
      const vibration = (rpm / 15000) * 0.02; // Máximo de 2cm de vibração
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 50) * vibration;
    }
  });

  // Atualizar materiais para mostrar calor
  useMemo(() => {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.name.toLowerCase().includes('engine') || mesh.name.toLowerCase().includes('motor')) {
          if (engineTempStatus === 'critical') {
            (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xff4444);
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
          } else if (engineTempStatus === 'warning') {
            (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffbb33);
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1;
          } else {
            (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
          }
        }
      }
    });
  }, [model, engineTempStatus]);

  return (
    <group 
      ref={groupRef}
      rotation={[
        THREE.MathUtils.degToRad(pitch), 
        THREE.MathUtils.degToRad(yaw + 180), 
        THREE.MathUtils.degToRad(-roll)
      ]}
    >
      <primitive object={model} />
      {/* Chão com reflexo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial 
          color="#08080a" 
          roughness={0.8} 
          metalness={0.2}
          transparent
          opacity={0.5}
        />
      </mesh>
      <gridHelper args={[20, 20, "#222", "#111"]} position={[0, 0, 0]} />
    </group>
  );
}

export default function Motorcycle3DView(props: Motorcycle3DViewProps) {
  return (
    <div className="three-canvas-container" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas 
        shadows={{ type: THREE.PCFShadowMap }} 
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[6, 3, 6]} fov={35} />
          <Environment preset="night" />
          
          <ambientLight intensity={0.2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow color="#4466ff" />
          <pointLight position={[-10, 5, -10]} intensity={1} color="#ff4444" />
          <directionalLight position={[0, 10, 0]} intensity={0.5} />
          
          <Model {...props} />
          
          <ContactShadows 
            position={[0, 0, 0]} 
            opacity={0.6} 
            scale={15} 
            blur={2} 
            far={4} 
            resolution={1024}
          />
          
          <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={4} 
            maxDistance={12}
            autoRotate={true}
            autoRotateSpeed={0.5}
            makeDefault
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
