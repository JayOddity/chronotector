import type { CSSProperties, ReactNode } from 'react';
import GameCorners from './GameCorners';

type Props = {
  children: ReactNode;
  className?: string;
  seal?: boolean;
  corners?: boolean;
  padding?: string;
  style?: CSSProperties;
};

export default function GamePanel({
  children,
  className = '',
  seal = false,
  corners = true,
  padding = 'p-6 sm:p-8',
  style,
}: Props) {
  return (
    <div
      className={`game-panel ${seal ? 'game-panel--seal' : ''} ${padding} ${className}`}
      style={style}
    >
      {corners && <GameCorners />}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
