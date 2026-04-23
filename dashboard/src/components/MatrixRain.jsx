import { useRef, useEffect } from 'react';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

export default function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let columns = [];
    let animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const fontSize = 14;
      const cols = Math.floor(canvas.width / fontSize);
      columns = Array.from({ length: cols }, () => ({
        y: Math.random() * canvas.height,
        speed: 0.3 + Math.random() * 0.7,
        chars: Array.from({ length: 30 }, () =>
          CHARS[Math.floor(Math.random() * CHARS.length)]
        ),
      }));
    }

    resize();
    window.addEventListener('resize', resize);

    const fontSize = 14;

    function draw() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      columns.forEach((col, i) => {
        const x = i * fontSize;

        // Draw trailing characters
        for (let j = 0; j < 8; j++) {
          const y = col.y - j * fontSize;
          if (y < 0 || y > canvas.height) continue;

          const alpha = (1 - j / 8) * 0.15;
          if (j === 0) {
            ctx.fillStyle = `rgba(0, 212, 170, ${alpha + 0.1})`;
          } else {
            ctx.fillStyle = `rgba(0, 180, 140, ${alpha})`;
          }
          ctx.font = `${fontSize}px monospace`;
          ctx.fillText(col.chars[j % col.chars.length], x, y);
        }

        col.y += col.speed * fontSize * 0.3;

        // Reset when off screen
        if (col.y > canvas.height + fontSize * 10) {
          col.y = -fontSize * 5;
          col.speed = 0.3 + Math.random() * 0.7;
          // Randomize some chars
          if (Math.random() > 0.7) {
            col.chars[Math.floor(Math.random() * col.chars.length)] =
              CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
      });

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.3,
      }}
    />
  );
}
