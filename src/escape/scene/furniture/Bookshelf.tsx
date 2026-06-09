import type { ThreeElements } from '@react-three/fiber';

const SHELF_COLOR = '#4a2f1a';
const BOOK_COLORS = ['#7a2e2e', '#2e4a7a', '#4a6b2e', '#6b5a2e', '#5a2e6b'];

// A tall bookcase with a few shelves of colored book spines (the anagram station —
// the player rearranges letters found among the books).
export function Bookshelf(props: ThreeElements['group']) {
  return (
    <group {...props}>
      {/* back panel */}
      <mesh position={[0, 1.2, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 2.4, 0.06]} />
        <meshStandardMaterial color="#3a2615" />
      </mesh>
      {/* sides */}
      {([-0.7, 0.7] as const).map((x, i) => (
        <mesh key={`side-${i}`} position={[x, 1.2, 0]} castShadow>
          <boxGeometry args={[0.08, 2.4, 0.4]} />
          <meshStandardMaterial color={SHELF_COLOR} />
        </mesh>
      ))}
      {/* horizontal shelves */}
      {[0.1, 0.7, 1.3, 1.9, 2.3].map((y, i) => (
        <mesh key={`shelf-${i}`} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.36, 0.06, 0.38]} />
          <meshStandardMaterial color={SHELF_COLOR} />
        </mesh>
      ))}
      {/* books on the lower shelves */}
      {[0.45, 1.05, 1.65].map((y, row) =>
        Array.from({ length: 6 }, (_, b) => (
          <mesh
            key={`book-${row}-${b}`}
            position={[-0.55 + b * 0.22, y, 0.05]}
            castShadow
          >
            <boxGeometry args={[0.16, 0.42, 0.28]} />
            <meshStandardMaterial color={BOOK_COLORS[(row + b) % BOOK_COLORS.length]} />
          </mesh>
        )),
      )}
    </group>
  );
}
