import { Canvas } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';

export function EscapeRoom({ onExit }: { onExit: () => void }) {
  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 70 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 3, 2]} intensity={20} castShadow color="#ffd9a0" />
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#a87b4a" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#2a1d12" />
        </mesh>
        <PointerLockControls />
      </Canvas>
      <button
        onClick={onExit}
        className="absolute left-4 top-4 z-10 rounded bg-slate-800/80 px-3 py-1 text-sm text-white"
      >
        ← Exit (Esc)
      </button>
    </div>
  );
}
