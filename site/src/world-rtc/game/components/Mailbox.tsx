// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Mailbox.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { Text } from '@react-three/drei';
import { GLBModel } from './GLBModel';
import { MODELS } from '../world/models';

interface MailboxProps {
  position: [number, number, number];
  rotation?: number;
  /** Family name shown in white vinyl letters on the side. */
  name?: string;
}

export function Mailbox({ position, rotation = 0, name }: MailboxProps) {
  const cfg = MODELS.mailbox;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} />
      {name && (
        <Text
          position={[0, 1.0, 0.22]}
          fontSize={0.085}
          color="#f0f0f0"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      )}
    </group>
  );
}
