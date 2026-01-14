
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Poop, GameStatus } from './types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  PLAYER_SIZE, 
  POOP_MIN_SIZE, 
  POOP_MAX_SIZE, 
  INITIAL_POOP_SPEED, 
  SPAWN_RATE,
  SPEED_INCREMENT
} from './constants';
import { audioService } from './services/audioService';
import { getFunnyComment, playTtsComment } from './services/geminiService';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('poop_highscore')) || 0);
  const [comment, setComment] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  
  // High-performance game state
  const gameState = useRef({
    playerX: GAME_WIDTH / 2 - PLAYER_SIZE / 2,
    poops: [] as Poop[],
    score: 0,
    keys: {} as { [key: string]: boolean },
    mouseX: GAME_WIDTH / 2,
    lastInputDevice: 'mouse' as 'mouse' | 'keyboard'
  });

  const handleGameOver = useCallback(async (finalScore: number) => {
    setStatus(GameStatus.GAMEOVER);
    audioService.playSquish();
    
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('poop_highscore', finalScore.toString());
    }

    // Start fetching comment immediately
    getFunnyComment(finalScore).then(sassyComment => {
      setComment(sassyComment);
      playTtsComment(sassyComment);
    });
  }, [highScore]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Player (🐣)
    ctx.font = `${PLAYER_SIZE}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const playerEmoji = status === GameStatus.GAMEOVER ? '😵' : '🐣';
    const wobble = status === GameStatus.PLAYING ? Math.sin(Date.now() / 80) * 3 : 0;
    ctx.fillText(playerEmoji, gameState.current.playerX + PLAYER_SIZE / 2, GAME_HEIGHT - PLAYER_SIZE / 2 - 10 + wobble);

    // Draw Poops (💩)
    gameState.current.poops.forEach(poop => {
      ctx.save();
      ctx.translate(poop.x + poop.size / 2, poop.y + poop.size / 2);
      ctx.rotate((poop.rotation * Math.PI) / 180);
      ctx.font = `${poop.size}px serif`;
      ctx.fillText('💩', 0, 0);
      ctx.restore();
    });
  };

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) return;
    
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (lastTimeRef.current !== undefined) {
      const deltaTime = Math.min(time - lastTimeRef.current, 32);
      const state = gameState.current;

      // Check if any movement keys are active
      const isLeftPressed = state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A'];
      const isRightPressed = state.keys['ArrowRight'] || state.keys['d'] || state.keys['D'];
      
      if (isLeftPressed || isRightPressed) {
        state.lastInputDevice = 'keyboard';
      }

      if (state.lastInputDevice === 'keyboard') {
        // Boosted keyboard speed for snappiness
        const kbMoveSpeed = 1.6 * deltaTime;
        if (isLeftPressed) state.playerX -= kbMoveSpeed;
        if (isRightPressed) state.playerX += kbMoveSpeed;
      } else {
        // Mouse follow logic - only if keyboard isn't taking over
        const targetX = state.mouseX - PLAYER_SIZE / 2;
        const followStrength = 0.4; 
        state.playerX += (targetX - state.playerX) * followStrength;
      }

      state.playerX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_SIZE, state.playerX));

      // Update Poops
      const currentDifficulty = 1 + (state.score * 0.08);
      if (Math.random() < (SPAWN_RATE * currentDifficulty)) {
        state.poops.push({
          id: Math.random(),
          x: Math.random() * (GAME_WIDTH - POOP_MAX_SIZE),
          y: -POOP_MAX_SIZE,
          speed: (INITIAL_POOP_SPEED + (state.score * SPEED_INCREMENT)) * (0.9 + Math.random() * 0.5),
          rotation: Math.random() * 360,
          size: POOP_MIN_SIZE + Math.random() * (POOP_MAX_SIZE - POOP_MIN_SIZE)
        });
      }

      let collision = false;
      state.poops = state.poops.filter(poop => {
        poop.y += poop.speed;
        poop.rotation += 7;

        const px = state.playerX + PLAYER_SIZE / 2;
        const py = GAME_HEIGHT - PLAYER_SIZE / 2 - 10;
        const dist = Math.sqrt(Math.pow(px - (poop.x + poop.size / 2), 2) + Math.pow(py - (poop.y + poop.size / 2), 2));
        
        if (dist < (PLAYER_SIZE + poop.size) * 0.38) {
          collision = true;
        }

        if (poop.y > GAME_HEIGHT) {
          state.score += 1;
          setScore(state.score);
          if (state.score % 10 === 0) audioService.playScore();
          return false;
        }
        return true;
      });

      if (collision) {
        handleGameOver(state.score);
        return;
      }

      draw(ctx);
    }
    
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  }, [status, handleGameOver]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      gameState.current.keys[e.key] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      gameState.current.keys[e.key] = false; 
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    gameState.current = {
      playerX: GAME_WIDTH / 2 - PLAYER_SIZE / 2,
      poops: [],
      score: 0,
      keys: gameState.current.keys,
      mouseX: GAME_WIDTH / 2,
      lastInputDevice: 'mouse'
    };
    setScore(0);
    setComment('');
    setStatus(GameStatus.PLAYING);
    audioService.playJump();
  };

  const handlePointer = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      gameState.current.mouseX = clientX - rect.left;
      gameState.current.lastInputDevice = 'mouse';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 select-none touch-none">
      <h1 className="text-4xl sm:text-5xl font-bold text-amber-700 mb-4 drop-shadow-md text-center">귀여운 똥 피하기! 💩</h1>
      
      <div 
        className="relative bg-amber-50 rounded-xl overflow-hidden shadow-2xl border-8 border-amber-200"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseMove={handlePointer}
          onTouchMove={handlePointer}
          className="absolute inset-0 z-0 cursor-none"
        />

        <div className="absolute top-4 w-full flex justify-between px-6 z-10 pointer-events-none">
          <div className="text-2xl text-amber-800 bg-white/70 px-4 py-1 rounded-full border-2 border-amber-200 shadow-sm font-bold">
            점수: {score}
          </div>
          <div className="text-lg text-amber-600 bg-white/50 px-3 py-1 rounded-full font-bold">
            최고: {highScore}
          </div>
        </div>

        {status === GameStatus.START && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center z-20">
            <div className="text-8xl mb-6 animate-bounce">🐣</div>
            <p className="text-xl mb-8 leading-relaxed font-bold">
              똥을 피하세요!<br/>
              <span className="text-amber-300 font-black">WASD 또는 마우스로 이동!</span>
            </p>
            <button 
              onClick={startGame}
              className="px-12 py-4 bg-amber-500 hover:bg-amber-600 rounded-full text-2xl font-bold shadow-lg transform transition active:scale-95"
            >
              시작하기!
            </button>
          </div>
        )}

        {status === GameStatus.GAMEOVER && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center z-20">
            <h2 className="text-6xl font-bold mb-4 text-red-400">GAME OVER</h2>
            <div className="text-3xl mb-2 font-bold">최종 점수: {score}</div>
            
            {comment ? (
              <div className="mt-4 p-4 bg-white/10 border border-white/20 rounded-xl italic text-amber-200 text-lg max-w-[90%] animate-in fade-in slide-in-from-bottom-2">
                 "{comment}"
              </div>
            ) : (
              <div className="mt-4 text-amber-200 italic animate-pulse">분석 중...</div>
            )}

            <button 
              onClick={startGame}
              className="mt-10 px-10 py-4 bg-amber-500 hover:bg-amber-600 rounded-full text-2xl font-bold shadow-lg transform transition active:scale-95"
            >
              다시 도전!
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 text-amber-900/60 text-sm font-bold flex flex-col items-center gap-1">
        <div>⬅️ ➡️ / A D 로 이동 (더 빠르게!)</div>
        <div className="text-amber-700/40 italic text-center">Gemini AI가 실시간으로 당신의 똥피하기 실력을 깐죽거리며 평가합니다.</div>
      </div>
    </div>
  );
};

export default App;
