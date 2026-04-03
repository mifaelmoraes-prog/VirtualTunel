import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PROFILE = [
  { x: -2.0, y: 0.3, z: 0.8, pressure: 0.3 },
  { x: -1.8, y: 0.4, z: 0.9, pressure: 0.2 },
  { x: -1.5, y: 0.5, z: 1.0, pressure: 0.1 },
  { x: -1.2, y: 0.6, z: 1.05, pressure: 0.0 },
  { x: -0.8, y: 0.7, z: 1.1, pressure: -0.1 },
  { x: -0.5, y: 0.9, z: 1.15, pressure: -0.2 },
  { x: -0.2, y: 1.1, z: 1.2, pressure: -0.15 },
  { x: 0.0, y: 1.2, z: 1.2, pressure: -0.1 },
  { x: 0.3, y: 1.15, z: 1.2, pressure: 0.1 },
  { x: 0.6, y: 1.1, z: 1.15, pressure: 0.3 },
  { x: 0.9, y: 1.0, z: 1.1, pressure: 0.5 },
  { x: 1.2, y: 0.85, z: 1.0, pressure: 0.7 },
  { x: 1.5, y: 0.7, z: 0.9, pressure: 0.8 },
  { x: 1.8, y: 0.5, z: 0.8, pressure: 0.9 },
  { x: 2.0, y: 0.35, z: 0.75, pressure: 0.95 },
];

const getVelocityColor = (velocity, maxVelocity) => {
  const t = Math.max(0, Math.min(1, velocity / maxVelocity));
  const white = new THREE.Color(1, 1, 1);
  const lightBlue = new THREE.Color(0.8, 0.9, 1.0);
  return white.lerp(lightBlue, t);
};

const PressureSmoke = ({ slices, showPressure }) => {
  const particlesRef = useRef();
  const particleCount = 1200;
  
  const { positions, colors, opacities, sizes, velocities, life } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const opa = new Float32Array(particleCount);
    const siz = new Float32Array(particleCount);
    const vel = new Float32Array(particleCount * 3);
    const lf = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const x = 6 - Math.random() * 1;
      const y = Math.random() * 2.2 + 0.1;
      const z = (Math.random() - 0.5) * 2.5;
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      vel[i * 3] = -1.2 - Math.random() * 0.3;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      opa[i] = 0;
      siz[i] = 0.2 + Math.random() * 0.15;
      
      col[i * 3] = 0.95;
      col[i * 3 + 1] = 0.95;
      col[i * 3 + 2] = 0.98;
      
      lf[i] = Math.random();
    }
    
    return { 
      positions: pos, 
      colors: col, 
      opacities: opa, 
      sizes: siz, 
      velocities: vel,
      life: lf
    };
  }, []);
  
  useFrame((state) => {
    if (!particlesRef.current || !showPressure) return;
    
    const positionAttr = particlesRef.current.geometry.attributes.position;
    const colorAttr = particlesRef.current.geometry.attributes.color;
    const opacityAttr = particlesRef.current.geometry.attributes.opacity;
    const sizeAttr = particlesRef.current.geometry.attributes.size;
    
    const time = state.clock.getElapsedTime();
    
    for (let i = 0; i < particleCount; i++) {
      let x = positionAttr.array[i * 3];
      let y = positionAttr.array[i * 3 + 1];
      let z = positionAttr.array[i * 3 + 2];
      
      life[i] += 0.008;
      
      if (life[i] > 1 || x < -5) {
        x = 6;
        y = Math.random() * 2.2 + 0.1;
        z = (Math.random() - 0.5) * 2.5;
        life[i] = 0;
      }
      
      let turbulence = 0;
      let nearCar = false;
      
      for (const slice of slices) {
        const distX = x - slice.x;
        const distZ = Math.abs(z);
        
        if (Math.abs(distX) < 1.5 && distZ < slice.z + 0.5 && y < slice.y + 0.5) {
          nearCar = true;
          
          const localTurb = (1 - Math.abs(distX) / 1.5) * (1 - distZ / (slice.z + 0.5));
          turbulence = Math.max(turbulence, localTurb);
          
          if (distZ < slice.z + 0.15 && y < slice.y + 0.1) {
            if (z >= 0) {
              z = slice.z + 0.2 + (1 - Math.abs(distX) / 1.5) * 0.1;
            } else {
              z = -slice.z - 0.2 - (1 - Math.abs(distX) / 1.5) * 0.1;
            }
            y = Math.max(y, slice.y + 0.15);
          }
        }
      }
      
      x += velocities[i * 3] * 0.016;
      y += velocities[i * 3 + 1] * 0.016 + turbulence * 0.01;
      z += velocities[i * 3 + 2] * 0.016 + (Math.random() - 0.5) * turbulence * 0.02;
      
      positionAttr.array[i * 3] = x;
      positionAttr.array[i * 3 + 1] = y;
      positionAttr.array[i * 3 + 2] = z;
      
      const lifeFade = 1 - life[i];
      const baseOpacity = nearCar ? 0.15 : 0.06;
      const turbOpacity = turbulence * 0.25;
      opacityAttr.array[i] = (baseOpacity + turbOpacity) * lifeFade;
      
      const laminarR = 0.95;
      const laminarG = 0.95;
      const laminarB = 0.98;
      const turbR = 0.85;
      const turbG = 0.8;
      const turbB = 0.75;
      
      colorAttr.array[i * 3] = laminarR + (turbR - laminarR) * turbulence;
      colorAttr.array[i * 3 + 1] = laminarG + (turbG - laminarG) * turbulence;
      colorAttr.array[i * 3 + 2] = laminarB + (turbB - laminarB) * turbulence;
      
      sizeAttr.array[i] = (0.15 + turbulence * 0.1) * lifeFade;
    }
    
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });
  
  if (!showPressure) return null;
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={particleCount}
          array={opacities}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 }
        }}
        vertexShader={`
          attribute float opacity;
          attribute float size;
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            vColor = color;
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (400.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(center);
            float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
            gl_FragColor = vec4(vColor, alpha);
          }
        `}
      />
    </points>
  );
};

const getPressureColor = (pressure) => {
  const t = (pressure + 1) / 2;
  const lowPressure = new THREE.Color(0.2, 0.3, 0.9);
  const highPressure = new THREE.Color(0.95, 0.2, 0.1);
  return lowPressure.lerp(highPressure, t);
};

const SlicedCarModel = ({ sliceCount, materialSettings, showPressure }) => {
  const groupRef = useRef();
  
  const carShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.8, 0.2);
    shape.lineTo(1.6, 0.25);
    shape.lineTo(1.2, 0.35);
    shape.lineTo(0.8, 0.5);
    shape.lineTo(0.4, 0.75);
    shape.lineTo(0.0, 1.0);
    shape.lineTo(-0.4, 1.15);
    shape.lineTo(-0.7, 1.2);
    shape.lineTo(-1.0, 1.15);
    shape.lineTo(-1.3, 1.0);
    shape.lineTo(-1.6, 0.75);
    shape.lineTo(-1.8, 0.5);
    shape.lineTo(-1.9, 0.35);
    shape.lineTo(-1.9, 0.2);
    shape.lineTo(1.8, 0.2);
    return shape;
  }, []);

  const slices = useMemo(() => {
    const result = [];
    const xMin = -1.9;
    const xMax = 1.9;
    const step = (xMax - xMin) / (sliceCount - 1);

    for (let i = 0; i < sliceCount; i++) {
      const x = xMin + i * step;
      const profileSlice = MODEL_PROFILE.reduce((prev, curr) => 
        Math.abs(curr.x - x) < Math.abs(prev.x - x) ? curr : prev);
      
      result.push({
        x,
        width: profileSlice.z,
        height: profileSlice.y,
        pressure: profileSlice.pressure
      });
    }
    return result;
  }, [sliceCount]);

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.5, 0]}>
        <extrudeGeometry args={[carShape, { depth: 1.6, bevelEnabled: false }]} />
        <meshStandardMaterial 
          color={showPressure ? "#8866aa" : materialSettings.carColor} 
          metalness={materialSettings.metalness} 
          roughness={materialSettings.roughness}
          envMapIntensity={1.5}
        />
      </mesh>
      
      {slices.map((slice, i) => {
        const sliceShape = new THREE.Shape();
        const w = slice.width;
        const h = slice.height;
        
        sliceShape.moveTo(-w, 0);
        sliceShape.lineTo(-w * 0.3, h * 0.25);
        sliceShape.lineTo(0, h);
        sliceShape.lineTo(w * 0.3, h * 0.25);
        sliceShape.lineTo(w, 0);
        sliceShape.lineTo(-w, 0);
        
        const pressureColor = getPressureColor(slice.pressure);
        
        return (
          <mesh key={i} position={[slice.x, 0, 0]} rotation={[0, 0, 0]}>
            <extrudeGeometry args={[sliceShape, { depth: 0.08, bevelEnabled: false }]} />
            <meshStandardMaterial 
              color={showPressure ? `#${pressureColor.getHexString()}` : (i % 2 === 0 ? "#2a2a4e" : "#1f1f3a")} 
              metalness={0.85} 
              roughness={0.2}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const StreamlinesWithSlices = ({ sliceCount, showStreamlines }) => {
  const lineCount = 30;
  const maxVelocity = 1.0;
  const baseSpeed = 0.2;
  
  const slices = useMemo(() => {
    const result = [];
    const xMin = -2.0;
    const xMax = 2.0;
    const step = (xMax - xMin) / (sliceCount - 1);

    for (let i = 0; i < sliceCount; i++) {
      const x = xMin + i * step;
      const topPoint = MODEL_PROFILE.find(p => Math.abs(p.x - x) < 0.15);
      if (topPoint) {
        result.push({ x, y: topPoint.y, z: topPoint.z });
      }
    }
    return result;
  }, [sliceCount]);

  if (!showStreamlines) return null;

  const lineData = useMemo(() => {
    const lines = [];
    const randomSeeds = [0.12, 0.45, 0.78, 0.23, 0.56, 0.89, 0.34, 0.67, 0.91, 0.15,
                          0.48, 0.72, 0.26, 0.59, 0.83, 0.38, 0.61, 0.94, 0.17, 0.52,
                          0.75, 0.29, 0.63, 0.86, 0.41, 0.69, 0.92, 0.25, 0.58, 0.81];
    
    for (let i = 0; i < lineCount; i++) {
      const linePoints = [];
      const lineVelocities = [];
      const zStart = (randomSeeds[i] - 0.5) * 4;
      const yStart = randomSeeds[i] * 1.5 + 0.2;
      
      let currentY = yStart;
      let currentZ = zStart;
      let prevX = 6;
      let prevY = currentY;
      let prevZ = currentZ;
      
      for (let j = 0; j < 60; j++) {
        const x = 6 - j * 0.2;
        
        let speedFactor = 1.0;
        
        for (const slice of slices) {
          const distX = x - slice.x;
          if (Math.abs(distX) < 0.8) {
            const influence = 1 - Math.abs(distX) / 0.8;
            const margin = 0.2;
            
            if (currentZ > -slice.z - margin && currentZ < slice.z + margin) {
              if (currentZ >= 0) {
                currentZ = slice.z + margin + influence * 0.15;
              } else {
                currentZ = -slice.z - margin - influence * 0.15;
              }
              speedFactor = Math.min(speedFactor, 0.3 + influence * 0.7);
            }
            
            if (currentY < slice.y + margin && currentZ > -slice.z - margin * 2 && currentZ < slice.z + margin * 2) {
              const heightInfluence = influence * (1 - (currentZ / (slice.z + margin)));
              currentY = Math.max(currentY, slice.y + margin + influence * 0.1);
              speedFactor = Math.min(speedFactor, 0.4 + heightInfluence * 0.6);
            }
          }
        }
        
        const dx = x - prevX;
        const dy = currentY - prevY;
        const dz = currentZ - prevZ;
        const velocity = Math.sqrt(dx * dx + dy * dy + dz * dz) * speedFactor / baseSpeed;
        
        linePoints.push(new THREE.Vector3(x, currentY, currentZ));
        lineVelocities.push(velocity);
        
        prevX = x;
        prevY = currentY;
        prevZ = currentZ;
      }
      lines.push({ points: linePoints, velocities: lineVelocities });
    }
    return lines;
  }, [slices]);

  return (
    <group rotation={[0, Math.PI, 0]}>
      {lineData.map((line, i) => (
        <VelocityLine key={i} points={line.points} velocities={line.velocities} maxVelocity={maxVelocity} />
      ))}
    </group>
  );
};

const VelocityLine = ({ points, velocities, maxVelocity }) => {
  const lineRef = useRef();
  
  const { geometry } = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colorsArray = new Float32Array(points.length * 3);
    
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
      
      const color = getVelocityColor(velocities[i], maxVelocity);
      colorsArray[i * 3] = color.r;
      colorsArray[i * 3 + 1] = color.g;
      colorsArray[i * 3 + 2] = color.b;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    
    return { geometry: geo };
  }, [points, velocities, maxVelocity]);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      lineRef.current.material.dashOffset = -clock.getElapsedTime() * 2;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineDashedMaterial 
        attach="material" 
        vertexColors 
        transparent 
        opacity={0.7} 
        dashSize={0.25} 
        gapSize={0.1} 
        linewidth={1}
      />
    </line>
  );
};

const Turbine = () => {
  const hubRef = useRef();
  
  useFrame(({ clock }) => {
    if (hubRef.current) {
      hubRef.current.rotation.z = clock.getElapsedTime() * 2;
    }
  });

  return (
    <group position={[-14, 4, -3]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.8, 0.8, 2, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.3} />
      </mesh>
      <group ref={hubRef}>
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <mesh key={i} position={[Math.cos(Math.PI * angle / 180) * 2.5, Math.sin(Math.PI * angle / 180) * 2.5, 0]} rotation={[0, 0, angle]}>
            <boxGeometry args={[4, 0.3, 0.1]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh position={[1.2, 0, 0]}>
        <cylinderGeometry args={[2, 2.5, 1.5, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.5} />
      </mesh>
    </group>
  );
};

const SafetyMarking = ({ startX, width }) => {
  return (
    <group>
      {Array.from({ length: Math.floor(width / 0.4) }).map((_, i) => (
        <mesh key={i} position={[startX + i * 0.4 + 0.2, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.2, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#ccaa00" : "#111111"} />
        </mesh>
      ))}
    </group>
  );
};

const AcousticPanels = () => {
  return (
    <group>
      {[-12, -8, -4, 4, 8, 12].map((x, i) => (
        <mesh key={i} position={[x, 5, -10]}>
          <planeGeometry args={[3, 8, 8, 8]} />
          <meshStandardMaterial color="#2a2a2e" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
};

const WindTunnel = ({ sliceCount = 8, materialSettings = {}, showStreamlines = true, showPressure = true }) => {
  const slices = useMemo(() => {
    const result = [];
    const xMin = -2.0;
    const xMax = 2.0;
    const step = (xMax - xMin) / (sliceCount - 1);

    for (let i = 0; i < sliceCount; i++) {
      const x = xMin + i * step;
      const profileSlice = MODEL_PROFILE.find(p => Math.abs(p.x - x) < 0.15);
      if (profileSlice) {
        result.push({ x, y: profileSlice.y, z: profileSlice.z });
      }
    }
    return result;
  }, [sliceCount]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
      <Canvas>
        <fog attach="fog" args={['#0d0d0d', 12, 35]} />
        <PerspectiveCamera makeDefault position={[-10, 5, 10]} fov={50} />
        <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2} />
        
        <ambientLight intensity={0.2} color="#303040" />
        <spotLight 
          position={[8, 14, 6]} 
          intensity={2.0} 
          color="#fff5e6" 
          angle={0.4} 
          penumbra={0.4}
          castShadow 
          shadow-mapSize={[2048, 2048]}
        />
        <spotLight 
          position={[-10, 12, -6]} 
          intensity={1.0} 
          color="#aaccff" 
          angle={0.5} 
          penumbra={0.7}
        />
        <pointLight position={[0, 6, 0]} intensity={0.5} color="#ff6633" />
        <spotLight position={[0, 8, 8]} intensity={0.8} color="#ffffff" angle={0.6} penumbra={0.8} />
        
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#0f0f0f" roughness={0.95} metalness={0.1} />
        </mesh>
        <SafetyMarking startX={-6} width={16} />
        
        <mesh position={[-18, 6, 0]}>
          <planeGeometry args={[0.3, 14, 20, 20]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.95} />
        </mesh>
        
        <mesh position={[18, 6, 0]}>
          <planeGeometry args={[0.3, 14, 20, 20]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.95} />
        </mesh>
        
        <mesh position={[0, 13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#0a0a0c" roughness={0.95} />
        </mesh>
        
        <AcousticPanels />
        <Turbine />
        
        <group position={[-8, -0.4, 10]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffaa66" distance={6} />
        </group>
        <group position={[8, -0.4, 10]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffaa66" distance={6} />
        </group>
        
        <StreamlinesWithSlices sliceCount={sliceCount} showStreamlines={showStreamlines} />
        <PressureSmoke slices={slices} showPressure={showPressure} />
        <SlicedCarModel sliceCount={sliceCount} materialSettings={materialSettings} showPressure={showPressure} />
      </Canvas>
    </div>
  );
};

export default WindTunnel;
