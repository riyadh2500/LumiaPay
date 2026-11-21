'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

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

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Click ripples
    const ripples: { x: number; y: number; r: number; opacity: number }[] = [];
    const onClick = (e: MouseEvent) => {
      ripples.push({ x: e.clientX, y: e.clientY, r: 0, opacity: 0.5 });
    };
    window.addEventListener('click', onClick);

    const orbs: { x: number; y: number; r: number; color: string; speed: number; mw: number }[] = [];

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      ctx.clearRect(0, 0, W, H);

      // Orbs
      orbs.forEach((orb, i) => {
        const bx = orb.x + Math.sin(t * orb.speed * 1000 + i) * 0.14;
        const by = orb.y + Math.cos(t * orb.speed * 800 + i * 1.3) * 0.12;
        const ox = (bx + (mouse.x - 0.5) * orb.mw) * W;
        const oy = (by + (mouse.y - 0.5) * orb.mw) * H;
        const radius = orb.r * Math.min(W, H);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        grad.addColorStop(0, orb.color + '22');
        grad.addColorStop(0.5, orb.color + '0e');
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Mouse spotlight
      const spotX = mouse.x * W;
      const spotY = mouse.y * H;
      const spot = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 250);
      spot.addColorStop(0, 'rgba(200,255,112,0.07)');
      spot.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(spotX, spotY, 250, 0, Math.PI * 2);
      ctx.fillStyle = spot;
      ctx.fill();

      // Cursor rings
      for (let r = 0; r < 2; r++) {
        const ringR = 18 + r * 16 + Math.sin(t * 0.05 + r) * 3;
        ctx.beginPath();
        ctx.arc(spotX, spotY, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,112,${0.12 - r * 0.04})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Click ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 4;
        rip.opacity -= 0.016;
        if (rip.opacity <= 0) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,112,${rip.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
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
