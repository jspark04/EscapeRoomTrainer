import type { ThreeElements } from '@react-three/fiber';

// A simple writing desk: a top slab on four legs, with a small inkwell + papers on top
// to hint that there's something to inspect here (the cipher station).
export function Desk(props: ThreeElements['group']) {
  return (
    <group {...props}>
      {/* top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.1, 0.8]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {/* legs */}
      {(
        [
          [-0.7, -0.3],
          [0.7, -0.3],
          [-0.7, 0.3],
          [0.7, 0.3],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]} castShadow>
          <boxGeometry args={[0.1, 0.75, 0.1]} />
          <meshStandardMaterial color="#3a2615" />
        </mesh>
      ))}
      {/* a sheet of paper with the cipher */}
      <mesh position={[0.1, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0.1]}>
        <planeGeometry args={[0.4, 0.55]} />
        <meshStandardMaterial color="#e8dcc0" />
      </mesh>
      {/* inkwell */}
      <mesh position={[-0.55, 0.84, -0.1]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} />
        <meshStandardMaterial color="#14110d" />
      </mesh>
    </group>
  );
}
