'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Orbs
    const orbs = [
      { x: 0.15, y: 0.2,  r: 0.38, color: '#c8ff70', speed: 0.0003 },
      { x: 0.85, y: 0.15, r: 0.32, color: '#1d71e8', speed: 0.0004 },
      { x: 0.5,  y: 0.85, r: 0.35, color: '#29d9a3', speed: 0.00035 },
      { x: 0.75, y: 0.65, r: 0.25, color: '#a78bfa', speed: 0.0005 },
    ];

    // Particles
    const PARTICLE_COUNT = 60;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      opacity: Math.random() * 0.6 + 0.2,
      color: ['#c8ff70', '#1d71e8', '#29d9a3', '#a78bfa'][Math.floor(Math.random() * 4)],
    }));

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      ctx.clearRect(0, 0, W, H);

      // Animated orbs (soft blurred blobs)
      orbs.forEach((orb, i) => {
        const ox = (orb.x + Math.sin(t * orb.speed * 1000 + i) * 0.12) * W;
        const oy = (orb.y + Math.cos(t * orb.speed * 800 + i * 1.3) * 0.1) * H;
        const radius = orb.r * Math.min(W, H);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        grad.addColorStop(0, orb.color + '22');
        grad.addColorStop(0.5, orb.color + '0d');
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * W;
          const dy = (particles[i].y - particles[j].y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(200, 255, 112, ${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x * W, particles[i].y * H);
            ctx.lineTo(particles[j].x * W, particles[j].y * H);
            ctx.stroke();
          }
        }
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      // Floating grid lines (subtle)
      ctx.strokeStyle = 'rgba(200,255,112,0.04)';
      ctx.lineWidth = 1;
      const gridOffset = (t * 0.3) % 80;
      for (let x = -80 + gridOffset; x < W + 80; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H + 80; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}
