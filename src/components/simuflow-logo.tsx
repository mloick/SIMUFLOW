import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Brand } from '@/constants/theme';

/** Le logo « chemin en S » (voir docs/logo/), dessiné en vectoriel. */
export function SimuflowLogo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="Logo SimuFlow" role="img">
      <Rect x={1} y={1} width={238} height={238} rx={54} fill="#ffffff" stroke="#d5e1ec" strokeWidth={2} />
      <Path
        d="M80 64 H150 A30 30 0 0 1 150 124 H90 A30 30 0 0 0 90 184 H160"
        fill="none"
        stroke={Brand.blue}
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={64} cy={64} r={18} fill={Brand.navy} />
      <Path
        d="M160 164 L190 184 L160 204 Z"
        fill={Brand.blue}
        stroke={Brand.blue}
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
