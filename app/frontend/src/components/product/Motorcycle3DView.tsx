import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

// ── Câmara fixa atrás da mota (3ª pessoa tipo jogo) ──────────────────
// Recebe o roll para a câmara reagir subtilmente às curvas
function FollowCamera({ roll }: { roll: number }) {
  const smoothRoll = useRef(0);

  useFrame(({ camera }) => {
    // Suavizar o roll da câmara
    smoothRoll.current += (roll - smoothRoll.current) * 0.03;

    // Câmara desloca-se lateralmente com o roll (como num jogo de corrida)
    const lateralOffset = Math.sin(THREE.MathUtils.degToRad(smoothRoll.current)) * 0.8;
    const rollTilt = Math.sin(THREE.MathUtils.degToRad(smoothRoll.current)) * 0.3;

    const offset = new THREE.Vector3(lateralOffset * 0.5, 2.5, 7);
    camera.position.lerp(offset, 0.06);

    // Olhar ligeiramente para o lado da curva
    const lookTarget = new THREE.Vector3(lateralOffset * 0.3, 1.0, 0);
    camera.lookAt(lookTarget);

    // Subtil rotação Z da câmara para acompanhar o lean
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, rollTilt * 0.08, 0.05);
  }, -1);
  return null;
}

// ── Céu com gradiente ─────────────────────────────────────────────────
function GradientSky() {
  const skyRef = useRef<THREE.ShaderMaterial>(null);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float y = dir.y * 0.5 + 0.5;

          // Day sky gradient (light blue/cyan to vibrant blue)
          vec3 horizonColor = vec3(0.6, 0.85, 0.98);
          vec3 zenithColor  = vec3(0.15, 0.5, 0.9);

          vec3 sky = mix(horizonColor, zenithColor, pow(max(y, 0.0), 0.8));

          // Horizon haze/glow
          float horizonGlow = exp(-pow((y - 0.5) * 5.0, 2.0));
          sky += vec3(0.8, 0.92, 1.0) * horizonGlow * 0.25;

          // Sun calculation
          vec3 sunDir = normalize(vec3(5.0, 10.0, -8.0));
          float sunCosTheta = max(dot(dir, sunDir), 0.0);
          
          // Sun disc (bright yellow-white center)
          float sunDisc = smoothstep(0.985, 0.992, sunCosTheta);
          // Sun glow (soft atmosphere scattering)
          float sunGlow = pow(sunCosTheta, 80.0) * 0.8 + pow(sunCosTheta, 8.0) * 0.2;
          
          vec3 sunColor = vec3(1.0, 0.98, 0.88);
          sky += sunColor * (sunDisc * 2.0 + sunGlow * 1.5);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh>
      <sphereGeometry args={[80, 32, 32]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

// ── Estrada/Alcatrão que se move com a velocidade ─────────────────────
function ScrollingRoad({ speed, modelColor }: { speed: number; modelColor: string }) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const scrollOffset = useRef(0);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uColor: { value: new THREE.Color(modelColor) },
        uSpeed: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uScroll;
        uniform vec3 uColor;
        uniform float uSpeed;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        // Simple noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec2 worldUV = vWorldPos.xz;
          vec2 scrolledUV = worldUV - vec2(0.0, uScroll);

          // --- Asphalt base ---
          float asphaltNoise = noise(scrolledUV * 8.0) * 0.3 + noise(scrolledUV * 24.0) * 0.15;
          vec3 asphaltColor = vec3(0.18, 0.19, 0.22) + asphaltNoise * 0.03;

          // --- Road markings ---
          // Center dashed line (yellow)
          float centerX = abs(worldUV.x);
          float centerLine = step(centerX, 0.06) * step(0.04, centerX);
          float dashPattern = step(0.5, fract(scrolledUV.y * 0.5));
          float centerMark = centerLine * dashPattern;

          // Side lane lines (white, continuous)
          float laneWidth = 3.0;
          float sideLineL = step(abs(worldUV.x + laneWidth) , 0.04);
          float sideLineR = step(abs(worldUV.x - laneWidth) , 0.04);

          // Edge lines (white, solid)
          float roadEdge = 5.5;
          float edgeL = step(abs(worldUV.x + roadEdge), 0.06);
          float edgeR = step(abs(worldUV.x - roadEdge), 0.06);

          // Apply markings
          vec3 col = asphaltColor;
          col = mix(col, vec3(0.85, 0.72, 0.1), centerMark * 0.7);       // Yellow center
          col = mix(col, vec3(0.8), (sideLineL + sideLineR) * 0.5);       // White lanes
          col = mix(col, vec3(0.7), (edgeL + edgeR) * 0.4);               // Edge lines

          // --- Subtle grid overlay (very faint) ---
          float gridSize = 2.0;
          vec2 grid = abs(fract(scrolledUV / gridSize - 0.5) - 0.5) / fwidth(scrolledUV / gridSize);
          float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);
          col += uColor * gridLine * 0.03;

          // --- Distance and side fade (Horizon fading) ---
          // Fade out towards the horizon (Z going deep negative)
          float zFade = 1.0 - smoothstep(10.0, 130.0, -worldUV.y);
          // Fade out towards the sides of the road plane (X going positive/negative)
          float xFade = 1.0 - smoothstep(5.5, 14.5, abs(worldUV.x));
          float fade = zFade * xFade;

          // --- Wet road reflection (subtle) ---
          float wetReflect = pow(max(0.0, 1.0 - abs(worldUV.x) / 6.0), 3.0) * 0.06;
          col += uColor * wetReflect * (0.5 + 0.5 * sin(uTime * 0.5));

          gl_FragColor = vec4(col, fade);
        }
      `,
    });
  }, [modelColor]);

  useFrame((state, delta) => {
    // Scroll road based on speed
    scrollOffset.current += (speed / 1.5) * delta;
    shaderMaterial.uniforms.uScroll.value = scrollOffset.current;
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    shaderMaterial.uniforms.uSpeed.value = speed;
    shaderMaterial.uniforms.uColor.value.set(modelColor);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -60]}>
      <planeGeometry args={[30, 150, 1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

// ── Partículas Atmosféricas (poeira da estrada) ───────────────────────
function RoadParticles({ speed, modelColor }: { speed: number; modelColor: string }) {
  const count = 80;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 12,
        y: Math.random() * 0.5 + 0.05,
        z: (Math.random() - 0.5) * 16,
        speed: 0.5 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2,
        scale: 0.008 + Math.random() * 0.015,
      });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const speedFactor = Math.max(speed / 20.0, 0.2);

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const px = p.x + Math.sin(t * 0.5 + p.phase) * 0.3;
      const py = p.y + Math.sin(t * p.speed * 2 + p.phase) * 0.1;
      // Particles flow backwards (simulating forward movement)
      let pz = p.z + (t * speedFactor * p.speed) % 16 - 8;
      if (pz > 8) pz -= 16;

      dummy.position.set(px, py, pz);
      const flickerScale = p.scale * (0.6 + 0.4 * Math.sin(t * 3 + p.phase));
      dummy.scale.setScalar(speed > 5 ? flickerScale : flickerScale * 0.3);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#aaaaaa" transparent opacity={0.25} />
    </instancedMesh>
  );
}

// ── Anel de luz à volta da mota ───────────────────────────────────────
function LightRing({ modelColor, rpm }: { modelColor: string; rpm: number }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    const pulseSpeed = 1 + (rpm / 5000);
    mat.opacity = 0.06 + Math.sin(t * pulseSpeed) * 0.03;
    ringRef.current.rotation.z = t * 0.05;
  });

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <ringGeometry args={[1.6, 2.0, 64]} />
      <meshBasicMaterial color={modelColor} transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Luzes accent dinâmicas ────────────────────────────────────────────
function AccentLights({ modelColor, rpm, engineTempStatus }: { modelColor: string; rpm: number; engineTempStatus: string }) {
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const rpmFactor = Math.min(rpm / 8000, 1);

    if (light1Ref.current) {
      light1Ref.current.position.set(
        Math.sin(t * 0.3) * 4,
        3 + Math.sin(t * 0.6) * 0.3,
        Math.cos(t * 0.3) * 4
      );
      light1Ref.current.intensity = 1.0 + rpmFactor * 1.5 + Math.sin(t * 1.5) * 0.2;
    }
    if (light2Ref.current) {
      light2Ref.current.position.set(
        Math.sin(t * 0.3 + Math.PI) * 4,
        2 + Math.cos(t * 0.4) * 0.3,
        Math.cos(t * 0.3 + Math.PI) * 4
      );
      light2Ref.current.intensity = 0.8 + rpmFactor * 1.0;
    }
  });

  const warnColor = engineTempStatus === 'critical' ? '#ff2222' : engineTempStatus === 'warning' ? '#ffaa00' : modelColor;

  return (
    <>
      <pointLight ref={light1Ref} color={modelColor} intensity={1.0} distance={12} decay={2} />
      <pointLight ref={light2Ref} color={warnColor} intensity={0.8} distance={10} decay={2} />
    </>
  );
}

// ── Fog ───────────────────────────────────────────────────────────────
function SceneFog() {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = new THREE.FogExp2('#bce2ff', 0.025);
  }, [scene]);
  return null;
}

// ── Modelo 3D (FIXO - só roll e pitch, sem yaw) ──────────────────────
function Model({ roll, pitch, yaw, speed, rpm, engineTempStatus, modelColor }: Motorcycle3DViewProps) {
  const fbx = useFBX('/motorcycle.fbx');
  const groupRef = useRef<THREE.Group>(null);
  const smoothRoll = useRef(0);
  const smoothPitch = useRef(0);
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

    // Interpolação suave e controlada
    const lerpSpeed = 0.25;
    smoothRoll.current += (roll - smoothRoll.current) * lerpSpeed;
    smoothPitch.current += (pitch - smoothPitch.current) * lerpSpeed;

    // Pitch subtil baseado na velocidade (inclina ligeiramente à frente a acelerar)
    const speedPitch = Math.min(speed / 200, 0.05);

    groupRef.current.rotation.set(
      THREE.MathUtils.degToRad(smoothPitch.current * 0.3) + speedPitch,  // Pitch + inclinação de velocidade
      Math.PI,                                                               // Virado para -Z (de costas para a câmara)
      THREE.MathUtils.degToRad(-smoothRoll.current),                      // Lean/roll completo
    );

    // Base position
    groupRef.current.position.set(0, 0, 0);

    // Wheels spin based on speed
    for (const w of wheelsRef.current) w.rotation.x += (speed * delta) / 5;

    // Engine vibration
    if (rpm > 1000) {
      vibPhase.current += delta * 50;
      groupRef.current.position.y += Math.sin(vibPhase.current) * (rpm / 15000) * 0.015;
    }

    // Deslocamento lateral proporcional ao lean (a mota desloca-se para o lado da curva)
    const leanOffset = Math.sin(THREE.MathUtils.degToRad(smoothRoll.current)) * 0.5;
    groupRef.current.position.x = leanOffset;
  });

  return (
    <group>
      <group ref={groupRef} name="bike" rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>

      {/* Chão base escuro estendido até ao horizonte */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color="#1a1b1e"
          roughness={0.7}
          metalness={0.2}
          envMapIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

// ── Farol da mota (cone de luz à frente) ──────────────────────────────
function HeadlightEffect() {
  const lightRef = useRef<THREE.SpotLight>(null);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.target.position.set(0, 0, -20);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <spotLight
      ref={lightRef}
      position={[0, 1.2, -1.5]}
      angle={0.4}
      penumbra={0.8}
      intensity={1.5}
      color="#ffffee"
      distance={25}
      decay={2}
    />
  );
}

export default function Motorcycle3DView(props: Motorcycle3DViewProps) {
  const mColor = props.modelColor || '#33b5e5';

  return (
    <div className="three-canvas-container" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 2.5, 7]} fov={38} />
        <Suspense fallback={null}>
          <SceneFog />

          {/* Céu com estrelas */}
          <GradientSky />

          {/* Iluminação base do dia */}
          <ambientLight intensity={0.55} color="#dbeeff" />

          {/* Luz do Sol (Key light direcional que gera sombras) */}
          <directionalLight
            position={[5, 10, -8]}
            intensity={2.8}
            castShadow
            color="#fffbee"
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0001}
          />

          {/* Rim/back light - silhueta com a cor do modelo */}
          <spotLight
            position={[-2, 4, -5]}
            angle={0.35}
            penumbra={1}
            intensity={1.2}
            color={mColor}
          />

          {/* Fill light suave da atmosfera */}
          <directionalLight position={[-3, 5, 2]} intensity={0.4} color="#bfe2ff" />

          {/* Farol da mota */}
          <HeadlightEffect />

          {/* Luzes accent animadas */}
          <AccentLights modelColor={mColor} rpm={props.rpm} engineTempStatus={props.engineTempStatus} />

          {/* Modelo da mota */}
          <Model {...props} />

          {/* Estrada/alcatrão que se move */}
          <ScrollingRoad speed={props.speed} modelColor={mColor} />

          {/* Anel de luz subtil */}
          <LightRing modelColor={mColor} rpm={props.rpm} />

          {/* Partículas de poeira */}
          <RoadParticles speed={props.speed} modelColor={mColor} />

          {/* Câmara fixa */}
          <FollowCamera roll={props.roll} />

          {/* Sombras de contacto */}
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.5}
            scale={20}
            blur={2.5}
            far={4}
            resolution={1024}
            color="#000000"
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
