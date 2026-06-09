import type { ThreeElements } from '@react-three/fiber';

type Props = ThreeElements['group'] & {
  /** When true the door swings open (after a correct final code). */
  open?: boolean;
};

// The exit: a door set into the wall with a small keypad beside it. Engaging it opens the
// keypad overlay; a correct code escapes the room and swings the door open.
export function ExitDoor({ open = false, ...props }: Props) {
  return (
    <group {...props}>
      {/* door frame */}
      <mesh position={[0, 1.05, -0.05]}>
        <boxGeometry args={[1.3, 2.3, 0.1]} />
        <meshStandardMaterial color="#2a1c10" />
      </mesh>
      {/* door leaf, hinged on the left */}
      <group position={[-0.55, 1.05, 0]} rotation={[0, open ? 1.4 : 0, 0]}>
        <mesh position={[0.55, 0, 0.06]} castShadow>
          <boxGeometry args={[1.1, 2.1, 0.08]} />
          <meshStandardMaterial color={open ? '#1a1208' : '#52351c'} />
        </mesh>
        {/* handle */}
        <mesh position={[0.95, 0, 0.12]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#c9a24b" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {/* keypad on the wall beside the door */}
      <mesh position={[0.9, 1.2, 0.08]}>
        <boxGeometry args={[0.3, 0.45, 0.06]} />
        <meshStandardMaterial color="#1c1c1f" />
      </mesh>
      <mesh position={[0.9, 1.38, 0.12]}>
        <planeGeometry args={[0.22, 0.08]} />
        <meshStandardMaterial color="#9fe6a0" emissive="#3a7a3a" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
