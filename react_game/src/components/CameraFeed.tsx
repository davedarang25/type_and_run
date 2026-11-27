import type { ReactNode } from 'react';

/** Realistic backrooms plates, one per atmosphere, drawn behind the corridor. */
const PLATE: Record<string, string> = {
  flickering: '/backrooms/lobby.jpg',
  misty: '/backrooms/warehouse.jpg',
  sterile: '/backrooms/warehouse.jpg',
  flooded: '/backrooms/poolrooms.jpg',
};
const CHASE_PLATE = '/backrooms/chase.jpg';

/** The "camera" viewport: backrooms plate, grain, scanlines, vignette and an apparition that sharpens as proximity rises. */
export function CameraFeed({ proximity, chasing, children, atmosphere }: {
  proximity: number;
  chasing: boolean;
  atmosphere: string;
  children: ReactNode;
}) {
  const p = proximity / 100;
  const tint: Record<string, string> = {
    flickering: '#1a1810', misty: '#121820', sterile: '#0f1a18', flooded: '#0b1420',
  };
  return (
    <div
      className={`feed rounded-xl border border-bone/10 ${chasing ? 'chase-pulse' : ''}`}
      style={{ background: `radial-gradient(ellipse at 50% 30%, ${tint[atmosphere] ?? '#15161b'} 0%, #050506 75%)` }}
    >
      {/* the corridor the streamer is standing in */}
      <div className="feed-plate" aria-hidden="true">
        <img src={PLATE[atmosphere] ?? PLATE.flickering} alt="" />
      </div>
      {/* the same corridor once something starts running */}
      <div className="feed-plate feed-plate-chase" aria-hidden="true" style={{ opacity: chasing ? 0.9 : 0 }}>
        <img src={CHASE_PLATE} alt="" />
      </div>
      <div className="grain" />
      {/* apparition */}
      <div
        className="apparition pointer-events-none absolute left-1/2 top-[8%] z-[1] h-[75%] w-40"
        style={{
          opacity: Math.max(0, p * 0.9 - 0.05),
          filter: `blur(${(1 - p) * 14 + 2}px)`,
          background: 'radial-gradient(ellipse 30% 14% at 50% 14%, rgb(220 225 230 / 0.55), transparent 70%), radial-gradient(ellipse 45% 55% at 50% 58%, rgb(200 205 215 / 0.32), transparent 72%)',
        }}
      />
      <div className="flicker relative z-10" style={{ ['--flicker-speed' as string]: `${Math.max(0.8, 5 - p * 4)}s` }}>
        {children}
      </div>
    </div>
  );
}
