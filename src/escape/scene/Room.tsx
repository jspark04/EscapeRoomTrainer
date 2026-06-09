export const ROOM_HALF = 5; // half-extent of the square room
const WALL_HEIGHT = 3.4;

// Warm "detective study" shell built from solid-colored standard materials only.
// No texture dependency on purpose: a missing texture file would make useTexture hang.
export function Room() {
  return (
    <group>
      <ambientLight intensity={0.45} color="#ffe9c8" />
      <pointLight
        position={[0, 3.2, 0]}
        intensity={28}
        distance={18}
        castShadow
        color="#ffce8a"
      />
      {/* a warmer desk-lamp accent so the room reads cozy rather than flat */}
      <pointLight position={[-3, 1.6, -3]} intensity={6} distance={6} color="#ffb866" />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>

      {/* ceiling */}
      <mesh position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#1c140d" />
      </mesh>

      {/* four walls (inner faces pointing toward the room center) */}
      {[
        { p: [0, WALL_HEIGHT / 2, -ROOM_HALF] as const, r: [0, 0, 0] as const },
        { p: [0, WALL_HEIGHT / 2, ROOM_HALF] as const, r: [0, Math.PI, 0] as const },
        { p: [-ROOM_HALF, WALL_HEIGHT / 2, 0] as const, r: [0, Math.PI / 2, 0] as const },
        { p: [ROOM_HALF, WALL_HEIGHT / 2, 0] as const, r: [0, -Math.PI / 2, 0] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.p} rotation={w.r} receiveShadow>
          <planeGeometry args={[ROOM_HALF * 2, WALL_HEIGHT]} />
          <meshStandardMaterial color="#3a2818" />
        </mesh>
      ))}
    </group>
  );
}
