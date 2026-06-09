import type { ThreeElements } from '@react-three/fiber';

type Props = ThreeElements['group'] & {
  /** When true the painting is swung aside, revealing the safe (after the safe is solved). */
  revealed?: boolean;
};

// A wall safe hidden behind a hinged painting (the combination station). Before the safe
// is solved the painting covers it; once solved the painting swings open and the safe door
// shows as ajar.
export function SafeAndPainting({ revealed = false, ...props }: Props) {
  return (
    <group {...props}>
      {/* safe body recessed into the wall */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.8, 0.4]} />
        <meshStandardMaterial color="#26282b" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* safe door */}
      <mesh position={[0, 0, 0.21]} rotation={[0, revealed ? -0.6 : 0, 0]}>
        <boxGeometry args={[0.72, 0.72, 0.04]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* dial */}
      <mesh position={[0.12, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
        <meshStandardMaterial color="#c9a24b" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* painting that hides the safe (hinged on the left edge) */}
      <group position={[-0.55, 0, 0.42]} rotation={[0, revealed ? 1.3 : 0, 0]}>
        <mesh position={[0.55, 0, 0]}>
          <boxGeometry args={[1.2, 1.0, 0.05]} />
          <meshStandardMaterial color="#6b4f2a" />
        </mesh>
        <mesh position={[0.55, 0, 0.03]}>
          <planeGeometry args={[1.0, 0.8]} />
          <meshStandardMaterial color="#2f4734" />
        </mesh>
      </group>
    </group>
  );
}
