import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Streamlines = () => {
  const lineCount = 40;
  const points = useMemo(() => {
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
      const linePoints = [];
      const y = (Math.random() - 0.5) * 4;
      const z = (Math.random() - 0.5) * 4;
      for (let j = 0; j < 20; j++) {
        const x = -10 + j * 1;
        // Add some perturbation around the center (where the car would be)
        const perturb = Math.exp(-(x * x) / 2) * 0.5;
        linePoints.push(new THREE.Vector3(x, y + perturb, z));
      }
      lines.push(linePoints);
    }
    return lines;
  }, []);

  return (
    <group>
      {points.map((line, i) => (
        <Line key={i} points={line} color="#00f2ff" />
      ))}
    </group>
  );
};

const Line = ({ points, color }) => {
  const lineRef = useRef();
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      lineRef.current.material.dashOffset = -clock.getElapsedTime() * 2;
    }
  });

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial attach="material" color={color} transparent opacity={0.3} dashSize={0.5} gapSize={0.2} />
    </line>
  );
};

const CarModel = () => {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[4, 1, 2]} />
        <MeshDistortMaterial
          color="#1a1a1a"
          speed={2}
          distort={0.1}
          radius={1}
        />
        {/* Mock Pressure Heatmap with Gradient Material */}
        <meshStandardMaterial attach="material" color="#222" metalness={0.8} roughness={0.2} />
      </mesh>
    </Float>
  );
};

const WindTunnel = () => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[-8, 4, 8]} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00f2ff" />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ff00ea" />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <gridHelper args={[20, 20, '#333', '#111']} position={[0, -1, 0]} />
        
        <Streamlines />
        <CarModel />
        
        <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#05070a" transparent opacity={0.8} />
        </mesh>
      </Canvas>
    </div>
  );
};

export default WindTunnel;
