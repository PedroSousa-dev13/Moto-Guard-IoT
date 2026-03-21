import React, { Suspense, useMemo, useRef, useEffect, useState } from 'react';
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
  lat?: number;       // current GPS position (live, updates every tick)
  lng?: number;
  originLat?: number; // route start point (fixed anchor for the map texture)
  originLng?: number;
  modelColor?: string;
  hasMapOrigin?: boolean;
}

const DEFAULT_LAT = 41.2951;
const DEFAULT_LNG = -7.7463;

// ── Scale constants ───────────────────────────────────────────────────────────
// Moto 3D model = 3 units = ~2.2m real  →  1 unit = 0.733m
const MOTO_REAL_LENGTH_M = 2.2;
const MOTO_3D_UNITS      = 3;
const METERS_PER_UNIT    = MOTO_REAL_LENGTH_M / MOTO_3D_UNITS; // 0.733 m/unit

const ZOOM      = 19;
const TILE_PX   = 256;
const GRID      = 5;
const CANVAS_PX = TILE_PX * GRID; // 1280px

// Metres covered by the full GRID×GRID texture at this lat
function textureMeters(lat: number) {
  const metersPerTile = (2 * Math.PI * 6378137 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, ZOOM);
  return metersPerTile * GRID;
}

// ── Geo offset → UV delta ─────────────────────────────────────────────────────
// Returns the UV offset (0..1 range) to shift the texture so the current
// position appears at the centre of the plane.
// OSM tiles: X = east (UV.x increases east), Y = south (UV.y increases south → flip)
function geoToUVOffset(
  originLat: number, originLng: number,
  currentLat: number, currentLng: number,
) {
  const R = 6378137;
  const avgLat = ((originLat + currentLat) / 2) * (Math.PI / 180);

  const dNorth = (currentLat - originLat) * (Math.PI / 180) * R; // + = north
  const dEast  = (currentLng - originLng) * (Math.PI / 180) * R * Math.cos(avgLat); // + = east

  const texM = textureMeters(originLat);

  // UV.x increases east, UV.y increases south in OSM tiles
  // Three.js CanvasTexture flips Y by default for DOM elements → UV.y increases north
  // So dNorth → +UV.y (no flip needed after Three.js auto-flip)
  return {
    u:  dEast  / texM,   // fraction of texture width
    v:  dNorth / texM,   // fraction of texture height (Three.js already flipped Y)
  };
}
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

// Exact fractional tile position (0..1 within the tile)
function latLngToTileFrac(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { xf, yf }; // integer part = tile index, fractional part = position within tile
}

// UV of a lat/lng within the GRID×GRID canvas texture
// The canvas has GRID tiles, center tile index = Math.floor(GRID/2)
function latLngToCanvasUV(lat: number, lng: number, originLat: number, originLng: number, zoom: number) {
  const half = Math.floor(GRID / 2);
  const originTile = latLngToTile(originLat, originLng, zoom);
  const { xf, yf } = latLngToTileFrac(lat, lng, zoom);

  // Position in tile-space relative to the top-left of the canvas
  const canvasTileX = (xf - originTile.x) + half;
  const canvasTileY = (yf - originTile.y) + half;

  // Convert to UV (0..1)
  return {
    u: canvasTileX / GRID,
    v: canvasTileY / GRID, // OSM Y: increases southward (down in canvas)
  };
}

// ── Hook: fetch OSM tiles → canvas → CanvasTexture ───────────────────────────
function useMapTexture(lat: number, lng: number, enabled: boolean) {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  // Create canvas + texture once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_PX;
    canvas.height = CANVAS_PX;
    canvasRef.current = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    textureRef.current = tex;
    // Don't expose texture yet — wait for tiles

    return () => { tex.dispose(); };
  }, []);

  // Re-fetch tiles whenever lat/lng changes AND enabled
  useEffect(() => {
    if (!enabled) return;

    const canvas  = canvasRef.current;
    const tex     = textureRef.current;
    if (!canvas || !tex) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    const center = latLngToTile(lat, lng, ZOOM);
    const half   = Math.floor(GRID / 2);
    let loaded   = 0;
    const total  = GRID * GRID;
    let cancelled = false;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = center.x + dx;
        const ty = center.y + dy;
        const px = (dx + half) * TILE_PX;
        const py = (dy + half) * TILE_PX;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          if (cancelled) return;
          ctx.drawImage(img, px, py, TILE_PX, TILE_PX);
          loaded++;
          if (loaded === total) {
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
            tex.needsUpdate = true;
            setTexture(tex); // expose only after first full load
          }
        };

        img.onerror = () => {
          if (cancelled) return;
          ctx.fillStyle = '#1a2035';
          ctx.fillRect(px, py, TILE_PX, TILE_PX);
          loaded++;
          if (loaded === total) {
            tex.needsUpdate = true;
            setTexture(tex);
          }
        };

        img.src = `https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`;
      }
    }

    return () => { cancelled = true; };
  }, [lat, lng, enabled]);

  return texture;
}

// ── Infinite map floor shader ─────────────────────────────────────────────────
// Everything in UV space (0..1). The plane is static; the shader pans+rotates.
const floorVertShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const floorFragShader = /* glsl */`
  uniform sampler2D uMap;
  uniform float     uHasMap;
  uniform vec2      uCenter;   // UV of the bike's current position in the texture (0..1)
  uniform float     uUVScale;  // fraction of texture visible around the centre
  uniform float     uYaw;      // bike heading in radians (OSM: north=0, east=+PI/2)

  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5; // -0.5..0.5, centre of plane

    // Scale: how much texture is visible
    vec2 scaled = c * uUVScale;

    // Rotate so the bike always faces "up" on screen
    // yaw=0 → north up; yaw=PI/2 → east up
    float cosY = cos(uYaw);
    float sinY = sin(uYaw);
    vec2 rotated = vec2(
       scaled.x * cosY + scaled.y * sinY,
      -scaled.x * sinY + scaled.y * cosY
    );

    // Translate so the bike's exact UV position is at the centre
    // OSM canvas: U increases east, V increases south
    // Three.js CanvasTexture flips V (south→north), so we negate V offset
    vec2 mapUv = rotated + vec2(uCenter.x, 1.0 - uCenter.y);

    vec4 col = vec4(0.07, 0.10, 0.13, 1.0);
    if (uHasMap > 0.5 && mapUv.x >= 0.0 && mapUv.x <= 1.0 &&
                         mapUv.y >= 0.0 && mapUv.y <= 1.0) {
      col = texture2D(uMap, mapUv);
    }

    float dist = length(c) * 2.0;
    float fade = 1.0 - smoothstep(0.45, 0.85, dist);
    gl_FragColor = vec4(col.rgb, fade);
  }
`;

function MapFloor({
  texture,
  yaw,
  originLat,
  centerU,
  centerV,
}: {
  texture: THREE.CanvasTexture | null;
  yaw: number;
  originLat: number;
  centerU: number; // UV of bike's current position in the canvas texture
  centerV: number;
}) {
  // Visible area: ~160m diameter at this camera angle
  const VISIBLE_METERS = 160;
  const texM    = textureMeters(originLat);
  const uvScale = VISIBLE_METERS / texM;

  const uniforms = useMemo(() => ({
    uMap:     { value: null as THREE.CanvasTexture | null },
    uHasMap:  { value: 0.0 },
    uCenter:  { value: new THREE.Vector2(0.5, 0.5) },
    uUVScale: { value: uvScale },
    uYaw:     { value: 0.0 },
  }), []);

  useEffect(() => {
    if (!texture) return;
    uniforms.uMap.value    = texture;
    uniforms.uHasMap.value = 1.0;
  }, [texture, uniforms]);

  const smoothCenter = useRef(new THREE.Vector2(0.5, 0.5));

  useFrame((_state, delta) => {
    const alpha = 1 - Math.exp(-10 * delta);
    smoothCenter.current.x += (centerU - smoothCenter.current.x) * alpha;
    smoothCenter.current.y += (centerV - smoothCenter.current.y) * alpha;

    uniforms.uCenter.value.set(smoothCenter.current.x, smoothCenter.current.y);
    uniforms.uYaw.value = THREE.MathUtils.degToRad(yaw);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[2000, 2000, 1, 1]} />
      <shaderMaterial
        vertexShader={floorVertShader}
        fragmentShader={floorFragShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Motorcycle model ──────────────────────────────────────────────────────────
function Model({ roll, pitch, yaw, speed, rpm, engineTempStatus }: Motorcycle3DViewProps) {
  const fbx       = useFBX('/motorcycle.fbx');
  const wheelsRef = useRef<THREE.Object3D[]>([]);
  const groupRef  = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clone = fbx.clone();
    const box   = new THREE.Box3().setFromObject(clone);
    const size  = box.getSize(new THREE.Vector3());
    const scale = MOTO_3D_UNITS / Math.max(size.x, size.y, size.z);
    clone.scale.setScalar(scale);
    clone.position.y = -box.min.y * scale;

    clone.traverse((child) => {
      const n = child.name.toLowerCase();
      if (n.includes('wheel') || n.includes('tire') || n.includes('rim')) {
        wheelsRef.current.push(child);
      }
    });
    return clone;
  }, [fbx]);

  useFrame((state, delta) => {
    wheelsRef.current.forEach((w) => { w.rotation.x += (speed * delta) / 5; });
    if (groupRef.current && rpm > 1000) {
      const v = (rpm / 15000) * 0.02;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 50) * v;
    }
  });

  useMemo(() => {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const n    = mesh.name.toLowerCase();
        if (n.includes('engine') || n.includes('motor')) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (engineTempStatus === 'critical')     { mat.emissive.set(0xff4444); mat.emissiveIntensity = 2; }
          else if (engineTempStatus === 'warning') { mat.emissive.set(0xffbb33); mat.emissiveIntensity = 1; }
          else                                     { mat.emissive.set(0x000000); mat.emissiveIntensity = 0; }
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
        THREE.MathUtils.degToRad(-roll),
      ]}
    >
      <primitive object={model} />
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene(props: Motorcycle3DViewProps & { mapTexture: THREE.CanvasTexture | null; originLat: number; originLng: number }) {
  const { mapTexture, modelColor = '#33b5e5', originLat, originLng, ...rest } = props;

  const currentLat = rest.lat ?? originLat;
  const currentLng = rest.lng ?? originLng;

  // Exact UV of the bike's current position within the canvas texture
  const center = rest.hasMapOrigin
    ? latLngToCanvasUV(currentLat, currentLng, originLat, originLng, ZOOM)
    : { u: 0.5, v: 0.5 };

  const isMoving = rest.speed > 0;

  return (
    <>
      <PerspectiveCamera makeDefault position={[6, 3, 6]} fov={35} />
      <Environment preset="night" />

      <ambientLight intensity={0.3} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#4466ff" />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#ff4444" />
      <directionalLight position={[0, 10, 0]} intensity={0.6} />
      <pointLight position={[0, 4, 3]}  intensity={3}   color={modelColor} distance={12} decay={2} />
      <pointLight position={[0, 1, -4]} intensity={1.5} color={modelColor} distance={8}  decay={2} />

      <MapFloor
        texture={mapTexture}
        yaw={rest.yaw}
        originLat={originLat}
        centerU={center.u}
        centerV={center.v}
      />

      <Model {...rest} />

      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={10} blur={2} far={3} resolution={256} />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={4}
        maxDistance={12}
        autoRotate={!isMoving}
        autoRotateSpeed={0.5}
        makeDefault
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Motorcycle3DView(props: Motorcycle3DViewProps) {
  // Map texture is always anchored to the route origin, not the live GPS
  const originLat = props.originLat ?? props.lat ?? DEFAULT_LAT;
  const originLng = props.originLng ?? props.lng ?? DEFAULT_LNG;
  const mapTexture = useMapTexture(originLat, originLng, props.hasMapOrigin ?? false);

  return (
    <div className="three-canvas-container" style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <Canvas
        shadows={false}
        camera={{ far: 3000 }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene {...props} mapTexture={mapTexture} originLat={originLat} originLng={originLng} />
        </Suspense>
      </Canvas>
    </div>
  );
}
