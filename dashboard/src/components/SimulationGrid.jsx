import { useRef, useEffect, useMemo, useCallback } from 'react';

const AGENT_COLORS = [
  '#00d4aa', '#7c5cfc', '#ff6b8a', '#ffaa22', '#44aaff',
  '#ff44aa', '#44ffaa', '#aa44ff', '#ffdd44', '#44ddff',
];

const LOCATION_STYLES = {
  commercial: { bg: '#0d1f0d', border: '#1a3a1a', icon: '\u{1F3EA}' },
  residential: { bg: '#0d0d1f', border: '#1a1a3a', icon: '\u{1F3E0}' },
  leisure: { bg: '#1f0d1a', border: '#3a1a2a', icon: '\u{1F333}' },
  generic: { bg: '#111118', border: '#222230', icon: '\u{1F4CD}' },
};

export default function SimulationGrid({ state, selectedAgent, onSelectAgent }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const prevPositions = useRef({});
  const currentPositions = useRef({});
  const transitionStart = useRef(0);
  const particlesRef = useRef([]);

  const { agents, environment } = state || {};
  const locations = environment?.locations || {};
  const gridW = environment?.width || 20;
  const gridH = environment?.height || 20;

  const agentColors = useMemo(() => {
    if (!agents) return {};
    const colors = {};
    Object.keys(agents).forEach((id, i) => {
      colors[id] = AGENT_COLORS[i % AGENT_COLORS.length];
    });
    return colors;
  }, [agents ? Object.keys(agents).join(',') : '']);

  // Update target positions when state changes
  useEffect(() => {
    if (!agents) return;
    const now = performance.now();
    let moved = false;

    Object.entries(agents).forEach(([id, agent]) => {
      const loc = locations[agent.location];
      if (!loc) return;
      const [lx, ly] = loc.position;
      const agentsAtLoc = Object.values(agents).filter(a => a.location === agent.location);
      const idx = agentsAtLoc.findIndex(a => a.id === id);
      const angle = (idx / agentsAtLoc.length) * Math.PI * 2 - Math.PI / 2;
      const radius = agentsAtLoc.length > 1 ? 0.8 : 0;
      const tx = lx + Math.cos(angle) * radius;
      const ty = ly + Math.sin(angle) * radius;

      const prev = currentPositions.current[id];
      if (prev && (Math.abs(prev.x - tx) > 0.1 || Math.abs(prev.y - ty) > 0.1)) {
        prevPositions.current[id] = { x: prev.x, y: prev.y };
        moved = true;
        // Spawn trail particles
        for (let p = 0; p < 5; p++) {
          particlesRef.current.push({
            x: prev.x, y: prev.y,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            life: 1.0,
            color: agentColors[id] || '#fff',
          });
        }
      } else if (!prev) {
        prevPositions.current[id] = { x: tx, y: ty };
      }
      currentPositions.current[id] = { x: tx, y: ty };
    });

    if (moved) transitionStart.current = now;
  }, [state]);

  const draw = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const size = Math.min(container.clientWidth, container.clientHeight);
    if (canvas.width !== size * 2) {
      canvas.width = size * 2;
      canvas.height = size * 2;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    }

    const ctx = canvas.getContext('2d');
    const scale = 2; // retina
    const cellW = (size * scale) / gridW;
    const cellH = (size * scale) / gridH;
    const elapsed = timestamp - transitionStart.current;
    const t = Math.min(1, elapsed / 600); // 600ms transition
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

    // Clear with slight trail
    ctx.fillStyle = 'rgba(10, 10, 15, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid dots
    ctx.fillStyle = '#151520';
    for (let x = 0; x <= gridW; x++) {
      for (let y = 0; y <= gridH; y++) {
        ctx.beginPath();
        ctx.arc(x * cellW, y * cellH, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw locations
    Object.values(locations).forEach(loc => {
      const [lx, ly] = loc.position;
      const style = LOCATION_STYLES[loc.type] || LOCATION_STYLES.generic;
      const occupants = loc.occupant_count || 0;

      // Location area with rounded corners
      const x = (lx - 1.5) * cellW;
      const y = (ly - 1.5) * cellH;
      const w = 4 * cellW;
      const h = 4 * cellH;
      const r = cellW * 0.3;

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = style.bg;
      ctx.fill();

      // Animated border glow if occupied
      if (occupants > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(timestamp / 1000 + lx);
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 1 + pulse;
        ctx.globalAlpha = 0.4 + 0.3 * pulse;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Location label
      ctx.fillStyle = '#444458';
      ctx.font = `${Math.max(16, cellW * 0.35)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(loc.name, (lx + 0.5) * cellW, (ly + 2) * cellH);

      // Occupant count badge
      if (occupants > 0) {
        const bx = (lx + 2) * cellW;
        const by = (ly - 1.3) * cellH;
        ctx.beginPath();
        ctx.arc(bx, by, cellW * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = '#00d4aa33';
        ctx.fill();
        ctx.fillStyle = '#00d4aa';
        ctx.font = `bold ${cellW * 0.22}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(occupants, bx, by);
      }
    });

    // Draw particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) return false;

      ctx.beginPath();
      ctx.arc(
        (p.x + 0.5) * cellW,
        (p.y + 0.5) * cellH,
        cellW * 0.08 * p.life,
        0, Math.PI * 2,
      );
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life * 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    // Draw agents
    if (agents) {
      Object.entries(agents).forEach(([id, agent]) => {
        const prev = prevPositions.current[id];
        const curr = currentPositions.current[id];
        if (!prev || !curr) return;

        // Interpolate position
        const ax = ((prev.x + (curr.x - prev.x) * eased) + 0.5) * cellW;
        const ay = ((prev.y + (curr.y - prev.y) * eased) + 0.5) * cellH;

        const color = agentColors[id] || '#ffffff';
        const isSelected = selectedAgent === id;
        const baseDotR = cellW * 0.3;
        const pulse = 1 + 0.1 * Math.sin(timestamp / 400 + ax);
        const dotRadius = isSelected ? baseDotR * 1.3 * pulse : baseDotR * pulse;

        // Outer glow
        const gradient = ctx.createRadialGradient(ax, ay, 0, ax, ay, dotRadius * 3);
        gradient.addColorStop(0, color + '30');
        gradient.addColorStop(1, color + '00');
        ctx.beginPath();
        ctx.arc(ax, ay, dotRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Selection ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(ax, ay, dotRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Agent dot
        ctx.beginPath();
        ctx.arc(ax, ay, dotRadius, 0, Math.PI * 2);
        const dotGrad = ctx.createRadialGradient(
          ax - dotRadius * 0.3, ay - dotRadius * 0.3, 0,
          ax, ay, dotRadius,
        );
        dotGrad.addColorStop(0, '#ffffff');
        dotGrad.addColorStop(0.4, color);
        dotGrad.addColorStop(1, color + 'aa');
        ctx.fillStyle = dotGrad;
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 15 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Agent name
        ctx.fillStyle = isSelected ? '#ffffff' : color;
        ctx.font = `bold ${Math.max(14, cellW * 0.32)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(agent.name, ax, ay - dotRadius - 6);
        ctx.shadowBlur = 0;

        // Action indicator
        if (agent.current_action && agent.current_action !== 'waits') {
          ctx.fillStyle = '#8888a0';
          ctx.font = `${Math.max(10, cellW * 0.2)}px sans-serif`;
          ctx.textBaseline = 'top';
          const actionText = agent.current_action.length > 25
            ? agent.current_action.slice(0, 25) + '...'
            : agent.current_action;
          ctx.fillText(actionText, ax, ay + dotRadius + 4);
        }
      });
    }

    animRef.current = requestAnimationFrame(draw);
  }, [agents, locations, selectedAgent, agentColors, gridW, gridH]);

  // Start animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  const handleClick = (e) => {
    if (!agents || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cellW = canvas.width / gridW;
    const cellH = canvas.height / gridH;

    let closest = null;
    let closestDist = Infinity;

    Object.entries(agents).forEach(([id]) => {
      const pos = currentPositions.current[id];
      if (!pos) return;
      const ax = (pos.x + 0.5) * cellW;
      const ay = (pos.y + 0.5) * cellH;
      const dist = Math.sqrt((x - ax) ** 2 + (y - ay) ** 2);
      if (dist < cellW * 0.8 && dist < closestDist) {
        closest = id;
        closestDist = dist;
      }
    });

    onSelectAgent(closest);
  };

  return (
    <div ref={containerRef} style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#08080d',
    }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ cursor: 'pointer', borderRadius: 8 }}
      />
    </div>
  );
}
