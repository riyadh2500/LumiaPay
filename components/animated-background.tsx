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

    // Mouse tracking - smooth lerp
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Orbs - follow mouse with different weights
    const orbs = [
      { x: 0.15, y: 0.2,  r: 0.42, color: '#c8ff70', speed: 0.0003, mouseWeight: 0.15 },
      { x: 0.85, y: 0.15, r: 0.35, color: '#1d71e8', speed: 0.0004, mouseWeight: -0.1 },
      { x: 0.5,  y: 0.85, r: 0.38, color: '#29d9a3', speed: 0.00035, mouseWeight: 0.08 },
      { x: 0.75, y: 0.65, r: 0.28, color: '#a78bfa', speed: 0.0005, mouseWeight: -0.12 },
      { x: 0.3,  y: 0.5,  r: 0.22, color: '#ff6b9d', speed: 0.0006, mouseWeight: 0.2 },
    ];

    // Particles
    const PARTICLE_COUNT = 70;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
      opacity: Math.random() * 0.5 + 0.2,
      color: ['#c8ff70', '#1d71e8', '#29d9a3', '#a78bfa'][Math.floor(Math.random() * 4)],
      mouseInfluence: Math.random() * 0.0003 + 0.0001,
    }));

    // Mouse repel/attract ripple
    const ripples: { x: number; y: number; r: number; opacity: number }[] = [];
    const onClick = (e: MouseEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        r: 0,
        opacity: 0.6,
      });
    };
    window.addEventListener('click', onClick);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      // Smooth mouse lerp
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      ctx.clearRect(0, 0, W, H);

      // ── Animated orbs with mouse influence ──
      orbs.forEach((orb, i) => {
        const baseX = orb.x + Math.sin(t * orb.speed * 1000 + i) * 0.12;
        const baseY = orb.y + Math.cos(t * orb.speed * 800 + i * 1.3) * 0.1;

        // Mouse push
        const ox = (baseX + (mouse.x - 0.5) * orb.mouseWeight) * W;
        const oy = (baseY + (mouse.y - 0.5) * orb.mouseWeight) * H;
        const radius = orb.r * Math.min(W, H);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        grad.addColorStop(0, orb.color + '28');
        grad.addColorStop(0.4, orb.color + '12');
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // ── Mouse spotlight ──
      const spotX = mouse.x * W;
      const spotY = mouse.y * H;
      const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 220);
      spotGrad.addColorStop(0, 'rgba(200,255,112,0.07)');
      spotGrad.addColorStop(0.5, 'rgba(200,255,112,0.03)');
      spotGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(spotX, spotY, 220, 0, Math.PI * 2);
      ctx.fillStyle = spotGrad;
      ctx.fill();

      // ── Particles with mouse repel ──
      particles.forEach(p => {
        // Mouse repel
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.12) {
          const force = (0.12 - dist) / 0.12;
          p.vx += (dx / dist) * force * 0.0008;
          p.vy += (dy / dist) * force * 0.0008;
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        // Distance to mouse for glow effect
        const dxM = p.x - mouse.x;
        const dyM = p.y - mouse.y;
        const distM = Math.sqrt(dxM * dxM + dyM * dyM);
        const glowFactor = distM < 0.15 ? 1 + (1 - distM / 0.15) * 1.5 : 1;

        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.size * glowFactor, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(Math.min(p.opacity * glowFactor, 1) * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Glow halo near mouse
        if (distM < 0.1) {
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = p.color + '15';
          ctx.fill();
        }
      });

      // ── Connection lines ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * W;
          const dy = (particles[i].y - particles[j].y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const alpha = 0.1 * (1 - dist / 110);
            ctx.strokeStyle = `rgba(200,255,112,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x * W, particles[i].y * H);
            ctx.lineTo(particles[j].x * W, particles[j].y * H);
            ctx.stroke();
          }
        }
      }

      // ── Mouse cursor trail ──
      const trailGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 40);
      trailGrad.addColorStop(0, 'rgba(200,255,112,0.12)');
      trailGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(spotX, spotY, 40, 0, Math.PI * 2);
      ctx.fillStyle = trailGrad;
      ctx.fill();

      // ── Ripple effects on click ──
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 4;
        rip.opacity -= 0.015;

        if (rip.opacity <= 0) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,112,${rip.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Second ring
        if (rip.r > 20) {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r * 0.6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(29,113,232,${rip.opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── Subtle grid ──
      ctx.strokeStyle = 'rgba(200,255,112,0.025)';
      ctx.lineWidth = 1;
      const gridOffset = (t * 0.2) % 80;
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
        opacity: 0.9,
      }}
    />
  );
}
