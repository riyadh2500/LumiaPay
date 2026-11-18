'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({
    x: 0.5, y: 0.5,
    targetX: 0.5, targetY: 0.5,
    vx: 0, vy: 0,
    prevX: 0.5, prevY: 0.5,
  });

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

    // Mouse
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Click ripples
    const ripples: { x: number; y: number; r: number; opacity: number; color: string }[] = [];
    const onClick = (e: MouseEvent) => {
      const colors = ['#c8ff70', '#1d71e8', '#29d9a3', '#a78bfa', '#ff6b9d'];
      ripples.push({ x: e.clientX, y: e.clientY, r: 0, opacity: 0.8, color: colors[Math.floor(Math.random() * colors.length)] });
      ripples.push({ x: e.clientX, y: e.clientY, r: 0, opacity: 0.4, color: colors[Math.floor(Math.random() * colors.length)] });
    };
    window.addEventListener('click', onClick);

    // Mouse trail
    const trail: { x: number; y: number; opacity: number; size: number; color: string }[] = [];
    const trailColors = ['#c8ff70', '#1d71e8', '#29d9a3', '#a78bfa'];

    // Orbs
    const orbs = [
      { x: 0.15, y: 0.2,  r: 0.42, color: '#c8ff70', speed: 0.0003, mw: 0.18 },
      { x: 0.85, y: 0.15, r: 0.35, color: '#1d71e8', speed: 0.0004, mw: -0.12 },
      { x: 0.5,  y: 0.85, r: 0.38, color: '#29d9a3', speed: 0.00035, mw: 0.1 },
      { x: 0.75, y: 0.65, r: 0.28, color: '#a78bfa', speed: 0.0005, mw: -0.15 },
      { x: 0.3,  y: 0.5,  r: 0.22, color: '#ff6b9d', speed: 0.0006, mw: 0.22 },
    ];

    // Particles
    const PARTICLE_COUNT = 80;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(), y: Math.random(),
      size: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
      opacity: Math.random() * 0.5 + 0.2,
      color: trailColors[Math.floor(Math.random() * trailColors.length)],
      originalVx: (Math.random() - 0.5) * 0.00015,
      originalVy: (Math.random() - 0.5) * 0.00015,
    }));

    // Floating crypto symbols
    const symbols = ['₿', 'Ξ', '$', '◎', '⬡', '◈', '⬟'].map((sym) => ({
      sym,
      x: Math.random(),
      y: Math.random() + 0.1,
      size: Math.random() * 14 + 10,
      opacity: Math.random() * 0.06 + 0.02,
      vy: -(Math.random() * 0.0001 + 0.00005),
      vx: (Math.random() - 0.5) * 0.00005,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.002,
    }));

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 1;

      const mouse = mouseRef.current;
      mouse.vx = (mouse.targetX - mouse.x) * 0.07;
      mouse.vy = (mouse.targetY - mouse.y) * 0.07;
      mouse.x += mouse.vx;
      mouse.y += mouse.vy;

      // Add trail point when mouse moves
      const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
      if (speed > 0.001) {
        trail.push({
          x: mouse.x * W,
          y: mouse.y * H,
          opacity: 0.6,
          size: Math.min(speed * 300, 6),
          color: trailColors[Math.floor(t / 10) % trailColors.length],
        });
      }
      // Fade and remove old trail
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].opacity -= 0.025;
        trail[i].size *= 0.95;
        if (trail[i].opacity <= 0) trail.splice(i, 1);
      }

      ctx.clearRect(0, 0, W, H);

      // ── Orbs ──
      orbs.forEach((orb, i) => {
        const bx = orb.x + Math.sin(t * orb.speed * 1000 + i) * 0.13;
        const by = orb.y + Math.cos(t * orb.speed * 800 + i * 1.3) * 0.11;
        const ox = (bx + (mouse.x - 0.5) * orb.mw) * W;
        const oy = (by + (mouse.y - 0.5) * orb.mw) * H;
        const radius = orb.r * Math.min(W, H);

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        grad.addColorStop(0, orb.color + '2a');
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
      const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 280);
      spotGrad.addColorStop(0, 'rgba(200,255,112,0.08)');
      spotGrad.addColorStop(0.4, 'rgba(200,255,112,0.03)');
      spotGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(spotX, spotY, 280, 0, Math.PI * 2);
      ctx.fillStyle = spotGrad;
      ctx.fill();

      // ── Mouse trail ──
      trail.forEach((tp) => {
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2);
        const hex = Math.round(tp.opacity * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = tp.color + hex;
        ctx.fill();
      });

      // ── Floating crypto symbols ──
      symbols.forEach((sym) => {
        sym.y += sym.vy;
        sym.x += sym.vx;
        sym.rotation += sym.rotSpeed;
        if (sym.y < -0.1) { sym.y = 1.1; sym.x = Math.random(); }

        ctx.save();
        ctx.translate(sym.x * W, sym.y * H);
        ctx.rotate(sym.rotation);
        ctx.font = `${sym.size}px Manrope, sans-serif`;
        ctx.fillStyle = `rgba(200,255,112,${sym.opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym.sym, 0, 0);
        ctx.restore();
      });

      // ── Particles ──
      particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Repel from mouse
        if (dist < 0.12 && dist > 0) {
          const force = (0.12 - dist) / 0.12;
          p.vx += (dx / dist) * force * 0.0012;
          p.vy += (dy / dist) * force * 0.0012;
        }

        // Slowly return to original velocity
        p.vx += (p.originalVx - p.vx) * 0.02;
        p.vy += (p.originalVy - p.vy) * 0.02;
        p.vx *= 0.97;
        p.vy *= 0.97;

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        const glowFactor = dist < 0.15 ? 1 + (1 - dist / 0.15) * 2 : 1;

        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.size * glowFactor, 0, Math.PI * 2);
        const hex = Math.round(Math.min(p.opacity * glowFactor, 1) * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = p.color + hex;
        ctx.fill();

        // Halo near mouse
        if (dist < 0.08) {
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, p.size * 5, 0, Math.PI * 2);
          ctx.fillStyle = p.color + '10';
          ctx.fill();
        }
      });

      // ── Connection lines ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * W;
          const dy = (particles[i].y - particles[j].y) * H;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(200,255,112,${0.1 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x * W, particles[i].y * H);
            ctx.lineTo(particles[j].x * W, particles[j].y * H);
            ctx.stroke();
          }
        }
      }

      // ── Cursor glow rings ──
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringR = 20 + r * 18 + Math.sin(t * 0.05 + r) * 4;
        const ringAlpha = (0.15 - r * 0.04) * (1 + speed * 5);
        ctx.beginPath();
        ctx.arc(spotX, spotY, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,112,${Math.min(ringAlpha, 0.3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── Click ripples ──
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 5;
        rip.opacity -= 0.018;
        if (rip.opacity <= 0) { ripples.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = rip.color + Math.round(rip.opacity * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (rip.r > 30) {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r * 0.55, 0, Math.PI * 2);
          ctx.strokeStyle = rip.color + Math.round(rip.opacity * 0.4 * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── Subtle moving grid ──
      ctx.strokeStyle = 'rgba(200,255,112,0.025)';
      ctx.lineWidth = 1;
      const gOff = (t * 0.2) % 80;
      for (let x = -80 + gOff; x < W + 80; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H + 80; y += 80) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
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
