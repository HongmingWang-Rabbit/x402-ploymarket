// Landing page configuration constants

export const LANDING_CONFIG = {
  // Brand
  brand: {
    name: 'PredictX',
    tagline: 'Decentralized Prediction Markets on Solana',
  },

  // Hero section
  hero: {
    badge: 'AI-Powered Market Generation',
    title: {
      line1: 'Decentralized',
      highlight1: 'Prediction',
      highlight2: 'Markets',
      line2: 'on Solana',
    },
    description:
      'Trade on future events with multi-chain payments via X402 protocol. Powered by AI market generation and secured by blockchain technology.',
    primaryCta: 'Start Trading',
    secondaryCta: 'View Markets',
  },

  // Features
  features: [
    {
      id: 'solana',
      title: 'Solana Blockchain',
      description:
        'Lightning-fast transactions with minimal fees on the Solana network for optimal trading experience.',
      iconType: 'solana' as const,
    },
    {
      id: 'x402',
      title: 'X402 Multi-Chain',
      description:
        'Seamless cross-chain payments and interactions through the innovative X402 protocol.',
      iconType: 'x402' as const,
    },
    {
      id: 'ai',
      title: 'AI Market Generation',
      description:
        'Intelligent algorithms create and curate prediction markets based on real-world events and trends.',
      iconType: 'ai' as const,
    },
  ],

  // Stats (placeholder values - should be fetched from API in production)
  stats: [
    { id: 'volume', value: '$47.2M', label: 'Total Volume', colorClass: 'text-purple-400' },
    { id: 'traders', value: '12,847', label: 'Active Traders', colorClass: 'text-blue-400' },
    { id: 'markets', value: '234', label: 'Active Markets', colorClass: 'text-white' },
    { id: 'uptime', value: '98.7%', label: 'Uptime', colorClass: 'text-green-400' },
  ],

  // CTA section
  cta: {
    title: 'Ready to Start Predicting?',
    description:
      'Join thousands of traders making predictions on real-world events with cutting-edge blockchain technology.',
    primaryButton: 'Connect Wallet & Trade',
    secondaryButton: 'Learn More',
  },

  // Footer
  footer: {
    sections: {
      platform: [
        { label: 'Markets', href: '/markets' },
        { label: 'Analytics', href: '/markets' },
        { label: 'Leaderboard', href: '/markets' },
        { label: 'API', href: '/markets' },
      ],
      support: [
        { label: 'Documentation', href: '#' },
        { label: 'Help Center', href: '#' },
        { label: 'Contact', href: '#' },
        { label: 'Bug Report', href: '#' },
      ],
    },
    social: {
      twitter: 'https://twitter.com',
      discord: 'https://discord.com',
      github: 'https://github.com',
    },
  },
} as const;

// Navigation configuration
export const NAV_LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/portfolio', label: 'Portfolio' },
] as const;

// Animation background configuration
export const ANIMATION_CONFIG = {
  // Colors
  colors: {
    background: 'rgb(3, 7, 18)',
    purple: {
      solid: 'rgba(167, 139, 250,',
      base: 'rgba(139, 92, 246,',
    },
    blue: {
      solid: 'rgba(96, 165, 250,',
      base: 'rgba(59, 130, 246,',
    },
    green: {
      solid: 'rgba(52, 211, 153,',
    },
  },

  // Neural network
  neuralNetwork: {
    layers: [4, 6, 8, 6, 4],
    neuronSpacing: 60,
    connectionOpacity: 0.2,
    activationChangeRate: 0.02,
  },

  // Floating nodes
  nodes: {
    count: 50,
    speed: 0.3,
    connectionDistance: 100,
    mouseInteractionDistance: 150,
    mouseRepulsionForce: 25,
  },

  // Binary streams
  binaryStreams: {
    count: 15,
    charsPerStream: 30,
    opacity: { min: 0.15, max: 0.40 },
    speed: { min: 0.15, max: 0.55 },
    fontSize: 12,
  },

  // Circuit paths
  circuits: {
    count: 6,
    segmentLength: { min: 40, max: 120 },
    yVariation: 80,
    opacity: 0.15,
    pulseSpeed: { min: 0.003, max: 0.011 },
  },

  // Grid
  grid: {
    size: 80,
    opacity: 0.05,
  },

  // Data packets
  packets: {
    spawnInterval: 0.3,
    speed: { min: 0.025, max: 0.045 },
    trailOpacity: 0.6,
  },

  // Thinking rings
  thinkingRings: {
    spawnProbability: 0.04,
    maxRadius: { min: 25, max: 40 },
    expandSpeed: 0.6,
    initialOpacity: 0.25,
  },

  // Mouse effects
  mouse: {
    glowRadius: 60,
    glowOpacity: 0.08,
    connectionBoost: 1.5,
    extendedConnectionDistance: 160,
  },

  // Scan line
  scanLine: {
    speed: 40,
    opacity: 0.06,
  },

  // Vignette
  vignette: {
    innerRadius: 0.5,
    opacity: 0.3,
  },
} as const;

// Type exports
export type Feature = (typeof LANDING_CONFIG.features)[number];
export type Stat = (typeof LANDING_CONFIG.stats)[number];
export type NavLink = (typeof NAV_LINKS)[number];
