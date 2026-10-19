import { AudioLines } from 'lucide-react';
import type { CSSProperties } from 'react';

const heights = [18, 30, 22, 38, 24, 48, 30, 42, 19, 34, 23, 44, 28, 38, 20, 31, 46, 24, 36, 19, 40, 26, 34, 18];

export function AudioVisualizer({ active }: { active: boolean }) {
  return (
    <div className={`visualizer ${active ? 'is-active' : ''}`} aria-label={active ? 'Decorative sound wave animation while music plays' : 'Sound wave paused'} role="img">
      <div className="visualizer-head"><AudioLines size={17} strokeWidth={1.8} /><span>{active ? 'IN THE GROOVE' : 'SOUND WAVES'}</span></div>
      <div className="wave-bars" aria-hidden="true">
        {heights.map((height, index) => <i key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${(index % 9) * -0.13}s` } as CSSProperties} />)}
      </div>
      <span className="visualizer-note">A little chaos, on a loop</span>
    </div>
  );
}
