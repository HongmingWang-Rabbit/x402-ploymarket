'use client';

import { useEffect, useRef } from 'react';
import { ANIMATION_CONFIG } from './constants';

// Types
interface Neuron {
  x: number;
  y: number;
  layer: number;
  index: number;
  activation: number;
  targetActivation: number;
  pulsePhase: number;
}

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  pulsePhase: number;
  type: 'processor' | 'data' | 'memory';
}

interface DataPacket {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
}

interface BinaryStream {
  x: number;
  chars: string[];
  speed: number;
  opacity: number;
}

interface CircuitPath {
  points: { x: number; y: number }[];
  pulsePosition: number;
  speed: number;
}

interface ThinkingRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

interface MouseState {
  x: number;
  y: number;
  active: boolean;
}

const config = ANIMATION_CONFIG;

// Utility functions
function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createNeurons(canvasWidth: number, canvasHeight: number): Neuron[] {
  const neurons: Neuron[] = [];
  const { layers, neuronSpacing } = config.neuralNetwork;
  const layerSpacing = canvasWidth / (layers.length + 1);
  const baseY = canvasHeight * 0.5;

  layers.forEach((count, layerIndex) => {
    const startY = baseY - ((count - 1) * neuronSpacing) / 2;
    for (let i = 0; i < count; i++) {
      neurons.push({
        x: layerSpacing * (layerIndex + 1),
        y: startY + i * neuronSpacing,
        layer: layerIndex,
        index: i,
        activation: Math.random(),
        targetActivation: Math.random(),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  });

  return neurons;
}

function createNodes(canvasWidth: number, canvasHeight: number): Node[] {
  const nodes: Node[] = [];
  const types: Node['type'][] = ['processor', 'data', 'memory'];

  for (let i = 0; i < config.nodes.count; i++) {
    const x = Math.random() * canvasWidth;
    const y = Math.random() * canvasHeight;
    nodes.push({
      x,
      y,
      baseX: x,
      baseY: y,
      vx: (Math.random() - 0.5) * config.nodes.speed,
      vy: (Math.random() - 0.5) * config.nodes.speed,
      pulsePhase: Math.random() * Math.PI * 2,
      type: types[Math.floor(Math.random() * types.length)],
    });
  }

  return nodes;
}

function createBinaryStreams(canvasWidth: number): BinaryStream[] {
  const streams: BinaryStream[] = [];
  const { count, charsPerStream, opacity, speed } = config.binaryStreams;

  for (let i = 0; i < count; i++) {
    const chars: string[] = [];
    for (let j = 0; j < charsPerStream; j++) {
      chars.push(Math.random() > 0.5 ? '1' : '0');
    }
    streams.push({
      x: Math.random() * canvasWidth,
      chars,
      speed: randomRange(speed.min, speed.max),
      opacity: randomRange(opacity.min, opacity.max),
    });
  }

  return streams;
}

function createCircuitPaths(canvasWidth: number, canvasHeight: number): CircuitPath[] {
  const paths: CircuitPath[] = [];
  const { count, segmentLength, yVariation, pulseSpeed } = config.circuits;

  for (let i = 0; i < count; i++) {
    const points: { x: number; y: number }[] = [];
    let x = 0;
    let y = Math.random() * canvasHeight;

    while (x < canvasWidth) {
      points.push({ x, y });
      x += randomRange(segmentLength.min, segmentLength.max);
      if (Math.random() > 0.5) {
        y += (Math.random() - 0.5) * yVariation;
        y = Math.max(50, Math.min(canvasHeight - 50, y));
      }
    }

    paths.push({
      points,
      pulsePosition: Math.random(),
      speed: randomRange(pulseSpeed.min, pulseSpeed.max),
    });
  }

  return paths;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Initialize entities
    const neurons = createNeurons(canvas.width, canvas.height);
    const nodes = createNodes(canvas.width, canvas.height);
    const binaryStreams = createBinaryStreams(canvas.width);
    const circuitPaths = createCircuitPaths(canvas.width, canvas.height);
    const dataPackets: DataPacket[] = [];
    const thinkingRings: ThinkingRing[] = [];

    let animationId: number;
    let time = 0;
    let lastPacketTime = 0;

    const draw = () => {
      const { colors, grid, circuits, binaryStreams: bsConfig, neuralNetwork, packets, nodes: nodeConfig, mouse: mouseConfig, thinkingRings: ringConfig, scanLine, vignette } = config;

      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.016;
      const mouse = mouseRef.current;

      // Draw grid
      ctx.strokeStyle = `${colors.purple.base} ${grid.opacity})`;
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += grid.size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += grid.size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw circuit paths
      circuitPaths.forEach((circuit) => {
        ctx.strokeStyle = `${colors.blue.base} ${circuits.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        circuit.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        circuit.pulsePosition += circuit.speed;
        if (circuit.pulsePosition > 1) circuit.pulsePosition = 0;

        const totalLength = circuit.points.length - 1;
        const pulseIndex = Math.floor(circuit.pulsePosition * totalLength);
        const localProgress = (circuit.pulsePosition * totalLength) % 1;

        if (pulseIndex < circuit.points.length - 1) {
          const p1 = circuit.points[pulseIndex];
          const p2 = circuit.points[pulseIndex + 1];
          const pulseX = p1.x + (p2.x - p1.x) * localProgress;
          const pulseY = p1.y + (p2.y - p1.y) * localProgress;

          ctx.fillStyle = `${colors.blue.base} 0.8)`;
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `${colors.blue.base} 0.3)`;
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw binary streams
      ctx.font = `${bsConfig.fontSize}px monospace`;
      binaryStreams.forEach((stream) => {
        stream.chars.forEach((char, i) => {
          const y = (time * stream.speed * 100 + i * 16) % (canvas.height + 150) - 50;
          const fade = i === 0 ? 1 : Math.max(0.3, 1 - i / stream.chars.length);
          ctx.fillStyle = `${colors.purple.base} ${stream.opacity * fade})`;
          ctx.fillText(char, stream.x, y);
        });
        if (Math.random() > 0.92) {
          const idx = Math.floor(Math.random() * stream.chars.length);
          stream.chars[idx] = Math.random() > 0.5 ? '1' : '0';
        }
      });

      // Draw neural network connections
      neurons.forEach((neuron) => {
        const nextLayerNeurons = neurons.filter((n) => n.layer === neuron.layer + 1);
        nextLayerNeurons.forEach((target) => {
          const weight = (neuron.activation + target.activation) / 2;
          ctx.strokeStyle = `${colors.purple.base} ${neuralNetwork.connectionOpacity * weight})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(neuron.x, neuron.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        });
      });

      // Draw neurons
      neurons.forEach((neuron) => {
        neuron.activation += (neuron.targetActivation - neuron.activation) * neuralNetwork.activationChangeRate;
        if (Math.random() > 0.99) {
          neuron.targetActivation = Math.random();
        }

        const pulse = Math.sin(time * 2 + neuron.pulsePhase) * 0.5 + 0.5;
        const radius = 2.5 + neuron.activation * 1.5;

        ctx.fillStyle = `${colors.purple.solid} ${0.4 + neuron.activation * 0.4})`;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (neuron.activation > 0.7) {
          ctx.strokeStyle = `${colors.purple.base} ${0.3 * pulse})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(neuron.x, neuron.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Spawn data packets
      if (time - lastPacketTime > packets.spawnInterval && Math.random() > 0.6) {
        const startNeuron = neurons[Math.floor(Math.random() * neurons.length)];
        const possibleTargets = neurons.filter((n) => n.layer === startNeuron.layer + 1);
        if (possibleTargets.length > 0) {
          const endNeuron = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
          dataPackets.push({
            x: startNeuron.x,
            y: startNeuron.y,
            targetX: endNeuron.x,
            targetY: endNeuron.y,
            progress: 0,
            speed: randomRange(packets.speed.min, packets.speed.max),
            color: Math.random() > 0.5 ? colors.blue.base : colors.purple.base,
          });
          lastPacketTime = time;
        }
      }

      // Draw data packets
      for (let i = dataPackets.length - 1; i >= 0; i--) {
        const packet = dataPackets[i];
        packet.progress += packet.speed;

        if (packet.progress >= 1) {
          dataPackets.splice(i, 1);
          continue;
        }

        const x = packet.x + (packet.targetX - packet.x) * packet.progress;
        const y = packet.y + (packet.targetY - packet.y) * packet.progress;

        ctx.strokeStyle = `${packet.color} ${packets.trailOpacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const trailStart = Math.max(0, packet.progress - 0.15);
        ctx.moveTo(
          packet.x + (packet.targetX - packet.x) * trailStart,
          packet.y + (packet.targetY - packet.y) * trailStart
        );
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = `${packet.color} 0.9)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update floating nodes
      nodes.forEach((node) => {
        node.baseX += node.vx;
        node.baseY += node.vy;

        if (node.baseX < 0 || node.baseX > canvas.width) node.vx *= -1;
        if (node.baseY < 0 || node.baseY > canvas.height) node.vy *= -1;

        if (mouse.active) {
          const dx = mouse.x - node.baseX;
          const dy = mouse.y - node.baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < nodeConfig.mouseInteractionDistance) {
            const force = (1 - distance / nodeConfig.mouseInteractionDistance) * nodeConfig.mouseRepulsionForce;
            node.x = node.baseX - (dx / distance) * force;
            node.y = node.baseY - (dy / distance) * force;
          } else {
            node.x = node.baseX;
            node.y = node.baseY;
          }
        } else {
          node.x = node.baseX;
          node.y = node.baseY;
        }
      });

      // Draw connections between nodes
      nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach((other) => {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          let maxDist: number = nodeConfig.connectionDistance;
          let opacityBoost = 1;
          if (mouse.active) {
            const midX = (node.x + other.x) / 2;
            const midY = (node.y + other.y) / 2;
            const mouseDist = Math.sqrt((mouse.x - midX) ** 2 + (mouse.y - midY) ** 2);
            if (mouseDist < mouseConfig.extendedConnectionDistance - 40) {
              maxDist = mouseConfig.extendedConnectionDistance;
              opacityBoost = mouseConfig.connectionBoost;
            }
          }

          if (distance < maxDist) {
            const opacity = (1 - distance / maxDist) * 0.25 * opacityBoost;
            ctx.strokeStyle = `${colors.purple.base} ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      const nodeColors = {
        processor: colors.purple.solid,
        data: colors.blue.solid,
        memory: colors.green.solid,
      };

      nodes.forEach((node) => {
        const pulse = Math.sin(time * 2 + node.pulsePhase) * 0.5 + 0.5;

        let glowMultiplier = 1;
        if (mouse.active) {
          const mouseDist = Math.sqrt((mouse.x - node.x) ** 2 + (mouse.y - node.y) ** 2);
          if (mouseDist < 120) glowMultiplier = 1 + (1 - mouseDist / 120) * 1.5;
        }

        const color = nodeColors[node.type];
        const radius = 2 + pulse * 0.5;

        ctx.fillStyle = `${color} ${0.5 + pulse * 0.3 * glowMultiplier})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (node.type === 'processor' && pulse > 0.6) {
          ctx.strokeStyle = `${color} 0.4)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, time * 3, time * 3 + Math.PI * 0.6);
          ctx.stroke();
        }
      });

      // Thinking rings near mouse
      if (mouse.active && Math.random() > 1 - ringConfig.spawnProbability) {
        thinkingRings.push({
          x: mouse.x + (Math.random() - 0.5) * 80,
          y: mouse.y + (Math.random() - 0.5) * 80,
          radius: 3,
          maxRadius: randomRange(ringConfig.maxRadius.min, ringConfig.maxRadius.max),
          opacity: ringConfig.initialOpacity,
        });
      }

      // Draw thinking rings
      for (let i = thinkingRings.length - 1; i >= 0; i--) {
        const ring = thinkingRings[i];
        ring.radius += ringConfig.expandSpeed;
        ring.opacity *= 0.97;

        if (ring.radius > ring.maxRadius || ring.opacity < 0.01) {
          thinkingRings.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `${colors.purple.base} ${ring.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Mouse glow
      if (mouse.active) {
        ctx.fillStyle = `${colors.purple.base} ${mouseConfig.glowOpacity})`;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouseConfig.glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Scan line
      const scanY = ((time * scanLine.speed) % (canvas.height + 60)) - 30;
      ctx.strokeStyle = `${colors.purple.base} ${scanLine.opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.stroke();

      // Vignette
      const vignetteGradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * vignette.innerRadius,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height
      );
      vignetteGradient.addColorStop(0, 'rgba(3, 7, 18, 0)');
      vignetteGradient.addColorStop(1, `rgba(3, 7, 18, ${vignette.opacity})`);
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: config.colors.background }}
    />
  );
}
