
export interface Poop {
  id: number;
  x: number;
  y: number;
  speed: number;
  rotation: number;
  size: number;
}

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER'
}
