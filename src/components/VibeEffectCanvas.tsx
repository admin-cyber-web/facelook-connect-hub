import { useEffect, useRef } from "react";
import type { VibeTag } from "@/lib/vibeMatcher";

interface Burst {
  at: number;
  x: number;
  y: number;
}

interface BurstParticle {
  burstIndex: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  size: number;
  color: string;
  cloud: boolean;
  rotation: number;
}

interface SmokePuff {
  burstIndex: number;
  delay: number;
  life: number;
  offsetX: number;
  offsetY: number;
  size: number;
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  wind: number;
  alpha: number;
  width: number;
}

interface LightningStrike {
  at: number;
  strength: number;
  points: Array<{ x: number; y: number }>;
  branch: Array<{ x: number; y: number }>;
}

const FIREWORK_COLORS = ["#fff8d1", "#ffe280", "#ffbb38", "#ff7b22", "#ffffff"];
const HOLI_COLORS = ["#ff286f", "#ffb71b", "#26d9e8", "#a855f7", "#ff5b3d", "#d7ff38"];
const EFFECT_DURATION = 5;
const SUPPORTED_TAGS = new Set<VibeTag>(["diwali_fest", "storm_alert", "holi_fest"]);

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const getBursts = (tag: VibeTag): Burst[] =>
  tag === "diwali_fest"
    ? [
        { at: 0.08, x: 0.19, y: 0.3 },
        { at: 1.02, x: 0.77, y: 0.27 },
        { at: 2.05, x: 0.53, y: 0.51 },
        { at: 3.12, x: 0.27, y: 0.66 },
      ]
    : [
        { at: 0.06, x: 0.15, y: 0.68 },
        { at: 0.91, x: 0.82, y: 0.62 },
        { at: 1.83, x: 0.53, y: 0.43 },
        { at: 2.76, x: 0.25, y: 0.31 },
        { at: 3.67, x: 0.76, y: 0.32 },
      ];

const createBurstParticles = (tag: VibeTag, bursts: Burst[]): BurstParticle[] => {
  const particles: BurstParticle[] = [];

  bursts.forEach((burst, burstIndex) => {
    if (tag === "diwali_fest") {
      const count = 62;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + randomBetween(-0.04, 0.04);
        const speed = randomBetween(0.18, 0.72);
        particles.push({
          burstIndex,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.04,
          gravity: randomBetween(0.28, 0.48),
          life: randomBetween(0.95, 1.82),
          size: randomBetween(0.0018, 0.0045),
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          cloud: false,
          rotation: 0,
        });
      }
      return;
    }

    for (let index = 0; index < 10; index += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(0.08, 0.34);
      particles.push({
        burstIndex,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: randomBetween(-0.025, 0.025),
        life: randomBetween(1.18, 2.05),
        size: randomBetween(0.018, 0.052),
        color: HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
        cloud: true,
        rotation: randomBetween(-0.8, 0.8),
      });
    }

    for (let index = 0; index < 34; index += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(0.12, 0.62);
      particles.push({
        burstIndex,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: randomBetween(-0.015, 0.04),
        life: randomBetween(0.9, 1.95),
        size: randomBetween(0.0015, 0.0048),
        color: HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)],
        cloud: false,
        rotation: randomBetween(-1, 1),
      });
    }
  });

  return particles;
};

const createSmokePuffs = (bursts: Burst[]): SmokePuff[] =>
  bursts.flatMap((_, burstIndex) =>
    Array.from({ length: 7 }, () => ({
      burstIndex,
      delay: randomBetween(0.05, 0.24),
      life: randomBetween(1.35, 2.05),
      offsetX: randomBetween(-0.09, 0.09),
      offsetY: randomBetween(-0.1, 0.06),
      size: randomBetween(0.045, 0.11),
    })),
  );

const createRainDrops = (width: number, height: number): RainDrop[] => {
  const count = Math.max(90, Math.min(250, Math.floor((width * height) / 1700)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: randomBetween(360, 850),
    length: randomBetween(12, 30),
    wind: randomBetween(-105, -48),
    alpha: randomBetween(0.16, 0.62),
    width: randomBetween(0.65, 1.7),
  }));
};

const makeLightningPath = (startX: number): LightningStrike["points"] => {
  const points = [{ x: startX, y: -0.03 }];
  for (let index = 1; index <= 11; index += 1) {
    points.push({
      x: Math.max(0.08, Math.min(0.92, startX + randomBetween(-0.075, 0.075))),
      y: (index / 11) * 0.82,
    });
  }
  return points;
};

const createLightningStrikes = (): LightningStrike[] =>
  [
    { at: 0.38, strength: 1, x: 0.69 },
    { at: 0.5, strength: 0.48, x: 0.69 },
    { at: 2.05, strength: 0.88, x: 0.33 },
    { at: 2.17, strength: 0.42, x: 0.33 },
    { at: 3.72, strength: 0.94, x: 0.61 },
    { at: 3.86, strength: 0.48, x: 0.61 },
  ].map(({ at, strength, x }) => {
    const points = makeLightningPath(x);
    const fork = points[5];
    const branch = [
      fork,
      { x: fork.x + 0.065, y: fork.y + 0.1 },
      { x: fork.x + 0.11, y: fork.y + 0.16 },
      { x: fork.x + 0.17, y: fork.y + 0.2 },
    ];
    return { at, strength, points, branch };
  });

const colorWithAlpha = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const drawCloud = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  rotation: number,
) => {
  if (radius <= 0 || alpha <= 0) return;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(1.55, 0.8);
  const gradient = context.createRadialGradient(0, 0, radius * 0.03, 0, 0, radius);
  gradient.addColorStop(0, colorWithAlpha(color, alpha * 0.58));
  gradient.addColorStop(0.34, colorWithAlpha(color, alpha * 0.32));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const drawFireworks = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  bursts: Burst[],
  particles: BurstParticle[],
  smokePuffs: SmokePuff[],
) => {
  const unit = Math.min(width, height);

  smokePuffs.forEach((puff) => {
    const burst = bursts[puff.burstIndex];
    const age = elapsed - burst.at - puff.delay;
    if (age < 0 || age > puff.life) return;
    const progress = age / puff.life;
    const fade = Math.pow(1 - progress, 1.35) * 0.24;
    const x = (burst.x + puff.offsetX * (0.35 + progress)) * width;
    const y = (burst.y + puff.offsetY * (0.35 + progress) - progress * 0.035) * height;
    drawCloud(
      context,
      x,
      y,
      unit * puff.size * (0.42 + progress * 1.2),
      "#aaa7a2",
      fade,
      puff.offsetX * 3,
    );
  });

  context.save();
  context.globalCompositeOperation = "lighter";
  bursts.forEach((burst) => {
    const age = elapsed - burst.at;
    if (age < 0 || age > 0.34) return;
    const fade = Math.max(0, 1 - age / 0.34) * 0.72;
    const x = burst.x * width;
    const y = burst.y * height;
    const radius = unit * (0.035 + age * 0.24);
    const bloom = context.createRadialGradient(x, y, 0, x, y, radius);
    bloom.addColorStop(0, `rgba(255, 249, 219, ${fade})`);
    bloom.addColorStop(0.18, `rgba(255, 181, 52, ${fade * 0.55})`);
    bloom.addColorStop(1, "rgba(255, 137, 24, 0)");
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  });

  particles.forEach((particle) => {
    const burst = bursts[particle.burstIndex];
    const age = elapsed - burst.at;
    if (age < 0 || age > particle.life) return;
    const progress = age / particle.life;
    const fade = Math.pow(1 - progress, particle.cloud ? 1.2 : 1.55);
    const x = burst.x * width + particle.vx * unit * age;
    const y =
      burst.y * height +
      particle.vy * unit * age +
      particle.gravity * unit * age * age * 0.5;

    if (particle.cloud) {
      context.globalCompositeOperation = "screen";
      drawCloud(
        context,
        x,
        y,
        unit * particle.size * (0.7 + progress * 1.4),
        particle.color,
        fade * 0.64,
        particle.rotation + age * 0.45,
      );
      context.globalCompositeOperation = "lighter";
      return;
    }

    const radius = Math.max(0.7, unit * particle.size * (1 - progress * 0.55));
    const velocityX = particle.vx * unit;
    const velocityY = (particle.vy + particle.gravity * age) * unit;
    context.globalAlpha = fade;
    context.strokeStyle = particle.color;
    context.fillStyle = particle.color;
    context.lineWidth = Math.max(0.65, radius * 0.9);
    context.shadowColor = particle.color;
    context.shadowBlur = radius * 8;
    context.beginPath();
    context.moveTo(x - velocityX * 0.055, y - velocityY * 0.055);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
};

const drawStorm = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  drops: RainDrop[],
  strikes: LightningStrike[],
) => {
  context.save();
  context.lineCap = "round";
  context.shadowColor = "rgba(143, 211, 255, .72)";
  context.shadowBlur = 5;
  drops.forEach((drop) => {
    const x = ((((drop.x + elapsed * drop.wind) % (width + 60)) + width + 60) % (width + 60)) - 30;
    const y = ((((drop.y + elapsed * drop.speed) % (height + 70)) + height + 70) % (height + 70)) - 35;
    context.globalAlpha = drop.alpha;
    context.strokeStyle = "rgba(197, 230, 255, .88)";
    context.lineWidth = drop.width;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - drop.length * 0.32, y + drop.length);
    context.stroke();
  });

  strikes.forEach((strike) => {
    const age = elapsed - strike.at;
    if (age < 0 || age > 0.16) return;
    const envelope =
      age < 0.025
        ? age / 0.025
        : Math.exp(-((age - 0.025) / 0.064) * 4.4);
    const intensity = Math.max(0, Math.min(1, envelope * strike.strength));
    if (intensity <= 0.01) return;

    context.globalCompositeOperation = "screen";
    context.globalAlpha = intensity * 0.7;
    context.fillStyle = "rgba(216, 239, 255, .88)";
    context.fillRect(0, 0, width, height);

    const drawBolt = (points: LightningStrike["points"], glow: boolean) => {
      context.beginPath();
      points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.globalAlpha = intensity * (glow ? 0.58 : 0.96);
      context.strokeStyle = glow ? "#70bdff" : "#f8fdff";
      context.lineWidth = glow ? Math.max(7, Math.min(width, height) * 0.027) : 2.2;
      context.shadowColor = glow ? "#4ca7ff" : "#eaf7ff";
      context.shadowBlur = glow ? 28 : 12;
      context.stroke();
    };

    drawBolt(strike.points, true);
    drawBolt(strike.branch, true);
    drawBolt(strike.points, false);
    drawBolt(strike.branch, false);
  });
  context.restore();
};

interface VibeEffectCanvasProps {
  active: boolean;
  vibeTag: VibeTag;
}

export default function VibeEffectCanvas({ active, vibeTag }: VibeEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || !SUPPORTED_TAGS.has(vibeTag)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const bursts = vibeTag === "storm_alert" ? [] : getBursts(vibeTag);
    const particles =
      vibeTag === "storm_alert" ? [] : createBurstParticles(vibeTag, bursts);
    const smokePuffs =
      vibeTag === "diwali_fest" ? createSmokePuffs(bursts) : [];
    const strikes = vibeTag === "storm_alert" ? createLightningStrikes() : [];
    let drops: RainDrop[] = [];
    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastFrameAt = 0;
    let stopped = false;
    const startedAt = performance.now();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      if (Math.abs(bounds.width - width) < 1 && Math.abs(bounds.height - height) < 1) return;
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (vibeTag === "storm_alert") drops = createRainDrops(width, height);
    };

    resize();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    if (!observer) window.addEventListener("resize", resize);

    const render = (timestamp: number) => {
      if (stopped) return;
      if (timestamp - lastFrameAt < 1000 / 30) {
        frameId = requestAnimationFrame(render);
        return;
      }
      lastFrameAt = timestamp;
      resize();
      const elapsed = (timestamp - startedAt) / 1000;

      if (elapsed >= EFFECT_DURATION) {
        context.clearRect(0, 0, width, height);
        canvas.style.opacity = "0";
        return;
      }

      canvas.style.opacity = "1";
      context.clearRect(0, 0, width, height);
      if (vibeTag === "storm_alert") {
        drawStorm(context, width, height, elapsed, drops, strikes);
      } else {
        drawFireworks(context, width, height, elapsed, bursts, particles, smokePuffs);
      }
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.opacity = "0";
    };
  }, [active, vibeTag]);

  if (!active || !SUPPORTED_TAGS.has(vibeTag)) return null;
  return <canvas ref={canvasRef} className="vibe-effect-canvas" aria-hidden="true" />;
}