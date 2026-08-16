import { useEffect, useRef } from 'react';

interface AuthSignalWaveProps {
  isLogin: boolean;
}

export function AuthSignalWave({ isLogin }: AuthSignalWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const pulseRef = useRef(1);

  // Trigger an energetic pulse ripple whenever the user switches between Sign In and Sign Up
  useEffect(() => {
    pulseRef.current = 2.4;
  }, [isLogin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      phaseRef.current += 0.022;
      // Decay pulse smoothly back to 1
      pulseRef.current += (1 - pulseRef.current) * 0.035;

      const phase = phaseRef.current;
      const pulse = pulseRef.current;

      // Draw subtle background ambient glow
      const glowGrad = ctx.createRadialGradient(
        isLogin ? w * 0.7 : w * 0.3,
        h * 0.5,
        10,
        w * 0.5,
        h * 0.5,
        w * 0.8
      );
      glowGrad.addColorStop(0, 'rgba(45, 90, 63, 0.28)');
      glowGrad.addColorStop(1, 'rgba(15, 43, 25, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // --- Wave 1: Primary Emerald EEG Wave ---
      ctx.beginPath();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(198, 231, 208, 0.42)';

      const midY1 = h * 0.52;
      for (let x = 0; x <= w; x += 3) {
        const normX = x / w;
        // Complex multi-frequency EEG wave
        const y =
          midY1 +
          Math.sin(normX * 5 + phase) * 22 * pulse +
          Math.sin(normX * 12 - phase * 1.4) * 9 * pulse +
          Math.sin(normX * 22 + phase * 0.8) * 4;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- Wave 2: Secondary Teal Harmonic Wave ---
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(15, 159, 152, 0.35)';

      const midY2 = h * 0.62;
      for (let x = 0; x <= w; x += 3) {
        const normX = x / w;
        const y =
          midY2 +
          Math.sin(normX * 4 - phase * 0.9) * 18 * pulse +
          Math.cos(normX * 9 + phase * 1.2) * 8 * pulse;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- Wave 3: Subtle High-Frequency Delta Wave ---
      ctx.beginPath();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';

      const midY3 = h * 0.42;
      for (let x = 0; x <= w; x += 4) {
        const normX = x / w;
        const y =
          midY3 +
          Math.sin(normX * 6 + phase * 1.3) * 14 * pulse +
          Math.sin(normX * 18 - phase) * 5;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- Glowing Travelling Signal Node (Spark) ---
      const sparkX = ((phase * 45) % (w + 40)) - 20;
      const normSparkX = Math.max(0, Math.min(1, sparkX / w));
      const sparkY =
        midY1 +
        Math.sin(normSparkX * 5 + phase) * 22 * pulse +
        Math.sin(normSparkX * 12 - phase * 1.4) * 9 * pulse +
        Math.sin(normSparkX * 22 + phase * 0.8) * 4;

      if (sparkX > 0 && sparkX < w) {
        const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 12);
        sparkGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        sparkGrad.addColorStop(0.3, 'rgba(198, 231, 208, 0.7)');
        sparkGrad.addColorStop(1, 'rgba(45, 90, 63, 0)');

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, [isLogin]);

  return (
    <canvas
      ref={canvasRef}
      className="auth-wave-canvas"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
