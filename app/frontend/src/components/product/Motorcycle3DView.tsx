import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useFBX, OrbitControls, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Motorcycle3DViewProps {
  roll: number;
  pitch: number;
  yaw: number;
  engineTempStatus: 'ok' | 'warning' | 'critical';
}

function Model({ roll, pitch, yaw, engineTempStatus }: Motorcycle3DViewProps) {
  const fbx = useFBX('/motorcycle.fbx');

  // Clone and scale the model
  const model = useMemo(() => {
    const clone = fbx.clone();
    // Auto-scale to fit common sizes
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim; // Normalize to about 3 units
    clone.scale.setScalar(scale);
    
    // Center it
    clone.position.y = -box.min.y * scale;
    
    return clone;
  }, [fbx]);

  // Update materials to show engine heat if needed
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
      rotation={[
        THREE.MathUtils.degToRad(pitch), 
        THREE.MathUtils.degToRad(yaw + 180), 
        THREE.MathUtils.degToRad(-roll)
      ]}
    >
      <primitive object={model} />
      {/* Floor to give sense of space */}
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
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
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
