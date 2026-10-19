export type GameState =
  | 'IDLE'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED_FOR_GAME'
  | 'PAUSED_BY_USER'
  | 'STOPPED'
  | 'ERROR';

export interface PauseBounds {
  minSeconds: number;
  maxSeconds: number;
}

export interface GameSnapshot {
  state: GameState;
  activeSeconds: number;
  targetSeconds: number;
  round: number;
  message: string | null;
  error: string | null;
}
