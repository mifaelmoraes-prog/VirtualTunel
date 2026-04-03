import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PROFILE = [
  { x: -2.0, y: 0.3, z: 0.8 },
  { x: -1.8, y: 0.4, z: 0.9 },
  { x: -1.5, y: 0.5, z: 1.0 },
  { x: -1.2, y: 0.6, z: 1.05 },
  { x: -0.8, y: 0.7, z: 1.1 },
  { x: -0.5, y: 0.9, z: 1.15 },
  { x: -0.2, y: 1.1, z: 1.2 },
  { x: 0.0, y: 1.2, z: 1.2 },
  { x: 0.3, y: 1.15, z: 1.2 },
  { x: 0.6, y: 1.1, z: 1.15 },
  { x: 0.9, y: 1.0, z: 1.1 },
  { x: 1.2, y: 0.85, z: 1.0 },
  { x: 1.5, y: 0.7, z: 0.9 },
  { x: 1.8, y: 0.5, z: 0.8 },
  { x: 2.0, y: 0.35, z: 0.75 },
];

const getVelocityColor = (velocity, maxVelocity) => {
  const t = Math.max(0, Math.min(1, velocity / maxVelocity));
  const r = 1 - t;
  const g = t * 0.3;
  const b = t;
  return new THREE.Color(r, g, b);
};

const SlicedCarModel = ({ sliceCount }) => {
  const groupRef = useRef();
  
  const carShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.8, 0.2);
    shape.lineTo(-1.6, 0.25);
    shape.lineTo(-1.2, 0.35);
    shape.lineTo(-0.8, 0.5);
    shape.lineTo(-0.4, 0.75);
    shape.lineTo(0.0, 1.0);
    shape.lineTo(0.4, 1.15);
    shape.lineTo(0.7, 1.2);
    shape.lineTo(1.0, 1.15);
    shape.lineTo(1.3, 1.0);
    shape.lineTo(1.6, 0.75);
    shape.lineTo(1.8, 0.5);
    shape.lineTo(1.9, 0.35);
    shape.lineTo(1.9, 0.2);
    shape.lineTo(-1.8, 0.2);
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
        height: profileSlice.y
      });
    }
    return result;
  }, [sliceCount]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
        <extrudeGeometry args={[carShape, { depth: 1.6, bevelEnabled: false }]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.15} />
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
        
        return (
          <mesh key={i} position={[slice.x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <extrudeGeometry args={[sliceShape, { depth: 0.08, bevelEnabled: false }]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? "#2a2a4e" : "#1f1f3a"} 
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

const StreamlinesWithSlices = ({ sliceCount }) => {
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
      let prevX = -6;
      let prevY = currentY;
      let prevZ = currentZ;
      
      for (let j = 0; j < 60; j++) {
        const x = -6 + j * 0.2;
        
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
    <group>
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

const WindTunnel = ({ sliceCount = 8 }) => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[-8, 4, 8]} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00f2ff" />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ff00ea" />
        <directionalLight position={[0, 10, 5]} intensity={0.5} />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <gridHelper args={[20, 20, '#333', '#111']} position={[0, -0.5, 0]} />
        
        <StreamlinesWithSlices sliceCount={sliceCount} />
        <SlicedCarModel sliceCount={sliceCount} />
        
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#05070a" transparent opacity={0.8} />
        </mesh>
      </Canvas>
    </div>
  );
};

export default WindTunnel;
