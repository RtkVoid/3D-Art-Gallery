import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ============================================
// IMAGE CONFIGURATION
// ============================================
// Add your image URLs here - they will be distributed across all frames
const IMAGE_URLS = [
  'https://i.imgur.com/364212A.jpg',
  'https://i.imgur.com/N2QE3pY.jpg',
  'https://i.imgur.com/bDvx9AX.jpg',
];

// ============================================
// MUSIC CONFIGURATION
// ============================================
// Replace this URL with your own music file (MP3, OGG, WAV)
const MUSIC_URLS = [
  'https://files.catbox.moe/emirxs.mp3', // Try catbox
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Fallback 1
  'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg', // Fallback 2 (Wikipedia)
];
const MUSIC_VOLUME = 0.3; // 0.0 to 1.0

// Constants
const PARTICLE_COUNT = 4000;
const SPHERE_RADIUS = 5;
const ROOM_WIDTH = 50;
const ROOM_HEIGHT = 30;
const ROOM_DEPTH = 50;
const BLOCK_SIZE = 2;
const FRAME_WIDTH = 1.8;
const FRAME_HEIGHT = 3.2;
const FRAME_ROWS = 5;
const FRAME_COLS = 10;
const FRAME_VERTICAL_SPACING = 5.2;
const FRAME_TOP_OFFSET = 5; // Increased from 2 to push frames down from ceiling

// Create polished stone texture
const createPolishedStoneTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(${15 + Math.random() * 20}, ${15 + Math.random() * 25}, ${20 + Math.random() * 30}, ${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 15; j++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(${30 + Math.random() * 30}, ${30 + Math.random() * 30}, ${35 + Math.random() * 30}, ${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 0.5 + Math.random() * 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

// Create environment map for reflections
const createEnvMap = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#0a0a15');
  gradient.addColorStop(0.3, '#050508');
  gradient.addColorStop(0.7, '#050508');
  gradient.addColorStop(1, '#030305');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 10; i++) {
    const x = 50 + i * 100;
    const grd = ctx.createRadialGradient(x, 80, 0, x, 80, 80);
    grd.addColorStop(0, 'rgba(180, 190, 220, 0.4)');
    grd.addColorStop(0.3, 'rgba(150, 160, 190, 0.2)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 80, 0, 160, 160);
  }

  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 3; i++) {
    const y = 380 + i * 40;
    const bandGrd = ctx.createLinearGradient(0, y - 20, 0, y + 20);
    bandGrd.addColorStop(0, 'transparent');
    bandGrd.addColorStop(0.5, 'rgba(150, 160, 180, 0.3)');
    bandGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = bandGrd;
    ctx.fillRect(0, y - 20, 1024, 40);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
};

const ArtGallery = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const textMeshRef = useRef(null);
  const gridWallsRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ horizontal: 0, vertical: 0 });
  const transformationStateRef = useRef('sphere');
  const transformationTimerRef = useRef(0);
  const hasStartedDissolvingRef = useRef(false);
  const [currentState, setCurrentState] = useState('sphere');
  const journeyProgressRef = useRef(0);
  const characterRef = useRef(null);
  const characterVelocity = useRef({ x: 0, y: 0, z: 0 });
  const keysPressed = useRef({ w: false, a: false, s: false, d: false, space: false, shift: false });
  const marbleTransitionRef = useRef(0);

  const [nearbyFrame, setNearbyFrame] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const nearbyFrameRef = useRef(null);

  // Music state
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [musicStarted, setMusicStarted] = useState(false);
  const audioRef = useRef(null);

  // Mobile detection and touch controls
  const [isMobile, setIsMobile] = useState(() => {
    // Check on initial render (only works client-side)
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 1024;
    }
    return false;
  });
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const touchCameraRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const tempMatrix = useRef(new THREE.Matrix4());
  const tempPosition = useRef(new THREE.Vector3());
  const tempScale = useRef(new THREE.Vector3());
  const tempQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (!containerRef.current) return;

    cameraAngleRef.current = { horizontal: 0, vertical: 0 };
    transformationStateRef.current = 'sphere';
    transformationTimerRef.current = 0;
    hasStartedDissolvingRef.current = false;
    journeyProgressRef.current = 0;
    scrollProgressRef.current = 0;
    marbleTransitionRef.current = 0;

    const disposables = { geometries: [], materials: [], textures: [] };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 10, 50);
    sceneRef.current = scene;

    const envMap = createEnvMap();
    disposables.textures.push(envMap);
    scene.environment = envMap;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 40);
    camera.lookAt(0, 0, -10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.7; // Increased for brighter output
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Ensure proper color space
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const stoneTexture = createPolishedStoneTexture();
    stoneTexture.repeat.set(4, 4);
    disposables.textures.push(stoneTexture);

    // Particles
    const sphereGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    disposables.geometries.push(sphereGeometry);

    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x8899bb,
      metalness: 0.95,
      roughness: 0.15,
      envMap: envMap,
      envMapIntensity: 1.5
    });
    disposables.materials.push(sphereMaterial);

    const instancedMesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, PARTICLE_COUNT);
    instancedMesh.position.z = -10;
    instancedMesh.castShadow = true;

    const originalPositions = [];
    const gatewayPositions = [];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const x = SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
      const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
      const z = SPHERE_RADIUS * Math.cos(phi);

      originalPositions.push({ x, y, z });
      position.set(x, y, z);
      matrix.setPosition(position);
      instancedMesh.setMatrixAt(i, matrix);

      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radiusVariation = (Math.random() - 0.5) * 0.8;
      const currentRadius = 4 + radiusVariation;

      gatewayPositions.push({
        x: Math.cos(angle) * currentRadius,
        y: Math.sin(angle) * currentRadius,
        z: (Math.random() - 0.5) * 0.3
      });
    }

    instancedMesh.userData.originalPositions = originalPositions;
    instancedMesh.userData.gatewayPositions = gatewayPositions;
    instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(instancedMesh);
    particlesRef.current = instancedMesh;

    // ENTER text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#6699ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#aaccff';
    ctx.fillText('ENTER', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    disposables.textures.push(texture);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    disposables.materials.push(spriteMaterial);

    const textSprite = new THREE.Sprite(spriteMaterial);
    textSprite.scale.set(4, 1, 1);
    textSprite.position.set(0, 0, -10);
    textSprite.visible = false;
    scene.add(textSprite);
    textMeshRef.current = textSprite;

    // ============================================
    // OPTIMIZED LIGHTING SETUP
    // ============================================
    
    const keyLight = new THREE.DirectionalLight(0x7799ff, 3.5);
    keyLight.position.set(5, 25, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 100;
    keyLight.shadow.camera.left = -50;
    keyLight.shadow.camera.right = 50;
    keyLight.shadow.camera.top = 50;
    keyLight.shadow.camera.bottom = -50;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x8866aa, 2, 60);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xaabbff, 3.5, 40);
    rimLight.position.set(0, 2, -20);
    scene.add(rimLight);

    const frontGlow = new THREE.PointLight(0x6699ff, 2.5, 35);
    frontGlow.position.set(0, 0, 5);
    scene.add(frontGlow);

    const ambientLight = new THREE.AmbientLight(0x334455, 0.8);
    scene.add(ambientLight);

    const gallerySpots = [];
    const spotPositions = [
      [0, 14, 0],
      [-20, 14, 0],
      [20, 14, 0],
    ];
    spotPositions.forEach(([x, y, z]) => {
      const spot = new THREE.SpotLight(0xffffff, 0, 80, Math.PI / 5, 0.4, 1.2);
      spot.position.set(x, y, z);
      spot.target.position.set(x, -15, z);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
      spot.shadow.bias = -0.0001;
      scene.add(spot);
      scene.add(spot.target);
      gallerySpots.push(spot);
    });

    const galleryAmbient = new THREE.HemisphereLight(0x8899aa, 0x222233, 0);
    scene.add(galleryAmbient);

    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    disposables.geometries.push(starsGeometry);

    const starsVertices = [];
    for (let i = 0; i < 2000; i++) {
      starsVertices.push(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
      );
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));

    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    disposables.materials.push(starsMaterial);

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // POLISHED FLOOR
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    disposables.geometries.push(floorGeometry);

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: stoneTexture.clone(),
      color: 0x080810,
      metalness: 0.9,
      roughness: 0.15,
      envMap: envMap,
      envMapIntensity: 1.5
    });
    floorMaterial.map.repeat.set(8, 8);
    disposables.materials.push(floorMaterial);

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -15, -10);
    floor.receiveShadow = true;
    scene.add(floor);

    // POLISHED WALLS
    const wallGeometry = new THREE.PlaneGeometry(100, 60);
    disposables.geometries.push(wallGeometry);

    const createWallMaterial = () => {
      const mat = new THREE.MeshStandardMaterial({
        map: stoneTexture.clone(),
        color: 0x080810,
        metalness: 0.9,
        roughness: 0.15,
        envMap: envMap,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide
      });
      mat.map.repeat.set(6, 4);
      disposables.materials.push(mat);
      return mat;
    };

    const backWall = new THREE.Mesh(wallGeometry, createWallMaterial());
    backWall.position.set(0, 15, -60);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(wallGeometry, createWallMaterial());
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-50, 15, -10);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, createWallMaterial());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(50, 15, -10);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const gridHelper = new THREE.GridHelper(100, 50, 0x222244, 0x111122);
    gridHelper.position.set(0, -14.99, -10);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);

    // Gallery walls (blocks)
    const gridWalls = new THREE.Group();
    gridWalls.visible = false;

    const cubeGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    disposables.geometries.push(cubeGeometry);

    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 1
    });
    disposables.materials.push(cubeMaterial);

    // Polished block material - SAME AS FLOOR
    const polishedBlockMaterial = new THREE.MeshStandardMaterial({
      map: stoneTexture.clone(),
      color: 0x080810,
      metalness: 0.9,
      roughness: 0.15,
      envMap: envMap,
      envMapIntensity: 1.5
    });
    polishedBlockMaterial.map.repeat.set(0.5, 0.5);
    disposables.materials.push(polishedBlockMaterial);

    const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
    disposables.geometries.push(edgesGeometry);

    const createBlock = (x, y, z) => {
      const block = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
      disposables.materials.push(block.material);
      block.castShadow = true;
      block.receiveShadow = true;

      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x222244,
        transparent: true,
        opacity: 1
      });
      disposables.materials.push(edgesMaterial);

      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

      const group = new THREE.Group();
      group.add(block);
      group.add(edges);

      group.userData = {
        finalPosition: { x, y, z },
        built: false,
        block: block,
        edges: edges,
        transitionedToMarble: false
      };

      group.position.set(x, -15, z);
      group.scale.set(0, 0, 0);

      return group;
    };

    const allBlocks = [];

    for (let y = -15; y < 15; y += BLOCK_SIZE) {
      for (let x = -ROOM_WIDTH / 2; x <= ROOM_WIDTH / 2; x += BLOCK_SIZE) {
        allBlocks.push(createBlock(x, y, -ROOM_DEPTH / 2));
        allBlocks.push(createBlock(x, y, ROOM_DEPTH / 2));
      }
      for (let z = -ROOM_DEPTH / 2 + BLOCK_SIZE; z < ROOM_DEPTH / 2; z += BLOCK_SIZE) {
        allBlocks.push(createBlock(-ROOM_WIDTH / 2, y, z));
        allBlocks.push(createBlock(ROOM_WIDTH / 2, y, z));
      }
    }

    const ceilingY = 15;
    for (let x = -ROOM_WIDTH / 2; x <= ROOM_WIDTH / 2; x += BLOCK_SIZE) {
      for (let z = -ROOM_DEPTH / 2; z <= ROOM_DEPTH / 2; z += BLOCK_SIZE) {
        allBlocks.push(createBlock(x, ceilingY, z));
      }
    }

    allBlocks.forEach(block => gridWalls.add(block));

    scene.add(gridWalls);
    gridWallsRef.current = gridWalls;
    gridWalls.userData.allBlocks = allBlocks;
    gridWalls.userData.polishedBlockMaterial = polishedBlockMaterial;

    // Image frames
    const frameGroup = new THREE.Group();
    frameGroup.visible = false;

    const wallWidth = ROOM_WIDTH - 4;
    const spacingX = wallWidth / (FRAME_COLS - 1);

    const frameGeometry = new THREE.PlaneGeometry(FRAME_WIDTH, FRAME_HEIGHT);
    disposables.geometries.push(frameGeometry);

    const frameBorderGeometry = new THREE.PlaneGeometry(FRAME_WIDTH + 0.2, FRAME_HEIGHT + 0.2);
    disposables.geometries.push(frameBorderGeometry);

    const createImageFrame = (x, y, z, rotationY = 0, frameIndex = 0) => {
      const frameContainer = new THREE.Group();

      const borderMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.4,
        metalness: 0.9,
        envMap: envMap,
        envMapIntensity: 1.2,
        transparent: true,
        opacity: 0
      });
      disposables.materials.push(borderMat);
      const border = new THREE.Mesh(frameBorderGeometry, borderMat);
      border.castShadow = true;
      frameContainer.add(border);

      const imagePlaneMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.3,
        emissive: 0x444444,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0
      });
      disposables.materials.push(imagePlaneMaterial);

      const imagePlane = new THREE.Mesh(frameGeometry, imagePlaneMaterial);
      imagePlane.position.z = 0.01;
      frameContainer.add(imagePlane);

      const glowGeometry = new THREE.PlaneGeometry(FRAME_WIDTH + 0.5, FRAME_HEIGHT + 0.5);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      });
      disposables.geometries.push(glowGeometry);
      disposables.materials.push(glowMaterial);
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.z = -0.02;
      frameContainer.add(glow);

      frameContainer.position.set(x, y, z);
      frameContainer.rotation.y = rotationY;

      frameContainer.userData = {
        imagePlane: imagePlane,
        border: border,
        glow: glow,
        glowMaterial: glowMaterial,
        frameIndex: frameIndex,
        imageUrl: null
      };

      return frameContainer;
    };

    let frameIndex = 0;
    const startX = -wallWidth / 2;
    const startY = ROOM_HEIGHT / 2 - FRAME_TOP_OFFSET;

    const backWallZ = -ROOM_DEPTH / 2 + 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const x = startX + col * spacingX;
        const y = startY - row * FRAME_VERTICAL_SPACING;
        frameGroup.add(createImageFrame(x, y, backWallZ, 0, frameIndex++));
      }
    }

    const frontWallZ = ROOM_DEPTH / 2 - 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const x = startX + col * spacingX;
        const y = startY - row * FRAME_VERTICAL_SPACING;
        frameGroup.add(createImageFrame(x, y, frontWallZ, Math.PI, frameIndex++));
      }
    }

    const leftWallX = -ROOM_WIDTH / 2 + 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const z = startX + col * spacingX;
        const y = startY - row * FRAME_VERTICAL_SPACING;
        frameGroup.add(createImageFrame(leftWallX, y, z, Math.PI / 2, frameIndex++));
      }
    }

    const rightWallX = ROOM_WIDTH / 2 - 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const z = startX + col * spacingX;
        const y = startY - row * FRAME_VERTICAL_SPACING;
        frameGroup.add(createImageFrame(rightWallX, y, z, -Math.PI / 2, frameIndex++));
      }
    }

    scene.add(frameGroup);
    gridWalls.userData.frameGroup = frameGroup;
    scene.userData.frameGroup = frameGroup;

    // Load images with TextureLoader
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';

    frameGroup.children.forEach((frame, index) => {
      const imageUrl = IMAGE_URLS[index % IMAGE_URLS.length];
      frame.userData.imageUrl = imageUrl;

      // Load texture
      textureLoader.load(
        imageUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const imagePlane = frame.userData.imagePlane;
          if (imagePlane) {
            imagePlane.material.map = tex;
            imagePlane.material.needsUpdate = true;
          }
        },
        undefined,
        (err) => {
          // On error, create placeholder
          const canv = document.createElement('canvas');
          canv.width = 512;
          canv.height = 910;
          const c = canv.getContext('2d');

          const hue = (index * 37) % 360;
          const grad = c.createLinearGradient(0, 0, 512, 910);
          grad.addColorStop(0, `hsl(${hue}, 40%, 25%)`);
          grad.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 50%, 35%)`);
          grad.addColorStop(1, `hsl(${(hue + 120) % 360}, 45%, 30%)`);
          c.fillStyle = grad;
          c.fillRect(0, 0, 512, 910);

          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.font = 'bold 48px Arial, sans-serif';
          c.textAlign = 'center';
          c.fillText(`Art #${index + 1}`, 256, 455);

          const tex = new THREE.CanvasTexture(canv);
          disposables.textures.push(tex);

          const imagePlane = frame.userData.imagePlane;
          if (imagePlane) {
            imagePlane.material.map = tex;
            imagePlane.material.needsUpdate = true;
          }
        }
      );
    });

    // Character
    const character = new THREE.Group();

    const orbGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    disposables.geometries.push(orbGeometry);

    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
      envMap: envMap,
      metalness: 0.3,
      roughness: 0.2
    });
    disposables.materials.push(orbMaterial);

    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.castShadow = true;
    character.add(orb);

    const ringGeometry = new THREE.TorusGeometry(0.7, 0.05, 16, 100);
    disposables.geometries.push(ringGeometry);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      emissive: 0x6699ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6
    });
    disposables.materials.push(ringMaterial);

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    character.add(ring);

    const charLight = new THREE.PointLight(0x99bbff, 3, 20);
    charLight.castShadow = true;
    charLight.shadow.mapSize.width = 512;
    charLight.shadow.mapSize.height = 512;
    character.add(charLight);

    character.position.set(0, -12, 0);
    character.visible = false;
    character.userData = { orb, ring, light: charLight };
    scene.add(character);
    characterRef.current = character;

    scene.userData.lights = {
      key: keyLight,
      fill: fillLight,
      rim: rimLight,
      front: frontGlow,
      ambient: ambientLight,
      gallerySpots,
      galleryAmbient
    };
    scene.userData.stars = stars;

    // Event handlers
    const handleMouseMove = (e) => {
      if (transformationStateRef.current === 'gateway' && textMeshRef.current && !isDraggingRef.current) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        document.body.style.cursor = raycaster.intersectObject(textMeshRef.current).length > 0 ? 'pointer' : 'default';
      }

      if (isDraggingRef.current && transformationStateRef.current !== 'traveling') {
        cameraAngleRef.current.horizontal -= (e.clientX - lastMouseRef.current.x) * 0.005;
        // Clamp vertical to prevent going under floor
        cameraAngleRef.current.vertical = Math.max(-Math.PI / 12, Math.min(Math.PI / 4,
          cameraAngleRef.current.vertical - (e.clientY - lastMouseRef.current.y) * 0.005));
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = (e) => {
      if (transformationStateRef.current === 'gateway' && textMeshRef.current) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        if (raycaster.intersectObject(textMeshRef.current).length > 0) {
          transformationStateRef.current = 'traveling';
          setCurrentState('traveling');
          journeyProgressRef.current = 0;
          return;
        }
      }

      if (transformationStateRef.current === 'gallery' && nearbyFrameRef.current) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(nearbyFrameRef.current, true);

        if (intersects.length > 0) {
          const frame = nearbyFrameRef.current;
          setSelectedFrame({
            index: frame.userData.frameIndex,
            imageUrl: frame.userData.imageUrl,
            texture: frame.userData.imagePlane?.material?.map
          });
          return;
        }
      }

      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = 'default';
    };

    // Touch handlers for sphere orbit and gateway/frame tap
    const handleTouchStartCanvas = (e) => {
      const touch = e.touches[0];
      
      // Check for gateway ENTER tap
      if (transformationStateRef.current === 'gateway' && textMeshRef.current) {
        const mouse = new THREE.Vector2(
          (touch.clientX / window.innerWidth) * 2 - 1,
          -(touch.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        if (raycaster.intersectObject(textMeshRef.current).length > 0) {
          transformationStateRef.current = 'traveling';
          setCurrentState('traveling');
          journeyProgressRef.current = 0;
          return;
        }
      }

      // Check for frame tap in gallery
      if (transformationStateRef.current === 'gallery' && nearbyFrameRef.current) {
        const mouse = new THREE.Vector2(
          (touch.clientX / window.innerWidth) * 2 - 1,
          -(touch.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(nearbyFrameRef.current, true);

        if (intersects.length > 0) {
          const frame = nearbyFrameRef.current;
          setSelectedFrame({
            index: frame.userData.frameIndex,
            imageUrl: frame.userData.imageUrl,
            texture: frame.userData.imagePlane?.material?.map
          });
          return;
        }
      }

      // Start drag for orbit
      isDraggingRef.current = true;
      lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMoveCanvas = (e) => {
      if (isDraggingRef.current && transformationStateRef.current !== 'traveling' && transformationStateRef.current !== 'gallery') {
        const touch = e.touches[0];
        cameraAngleRef.current.horizontal -= (touch.clientX - lastMouseRef.current.x) * 0.005;
        cameraAngleRef.current.vertical = Math.max(-Math.PI / 12, Math.min(Math.PI / 4,
          cameraAngleRef.current.vertical - (touch.clientY - lastMouseRef.current.y) * 0.005));
        lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchEndCanvas = () => {
      isDraggingRef.current = false;
    };

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysPressed.current.w = true;
      if (key === 'a' || key === 'arrowleft') keysPressed.current.a = true;
      if (key === 's' || key === 'arrowdown') keysPressed.current.s = true;
      if (key === 'd' || key === 'arrowright') keysPressed.current.d = true;
      if (key === ' ') { e.preventDefault(); keysPressed.current.space = true; }
      if (key === 'shift') keysPressed.current.shift = true;
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysPressed.current.w = false;
      if (key === 'a' || key === 'arrowleft') keysPressed.current.a = false;
      if (key === 's' || key === 'arrowdown') keysPressed.current.s = false;
      if (key === 'd' || key === 'arrowright') keysPressed.current.d = false;
      if (key === ' ') keysPressed.current.space = false;
      if (key === 'shift') keysPressed.current.shift = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStartCanvas, { passive: false });
    window.addEventListener('touchmove', handleTouchMoveCanvas, { passive: false });
    window.addEventListener('touchend', handleTouchEndCanvas);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation loop
    let lastTime = performance.now();
    let animationFrameId = null;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const time = currentTime * 0.001;
      const { lights } = scene.userData;

      // State machine
      if (scrollProgressRef.current >= 99) {
        hasStartedDissolvingRef.current = true;
        transformationTimerRef.current += deltaTime;

        if (transformationTimerRef.current < 5) {
          if (transformationStateRef.current !== 'dissolving') {
            transformationStateRef.current = 'dissolving';
            setCurrentState('dissolving');
          }
        } else if (transformationTimerRef.current < 8) {
          if (transformationStateRef.current !== 'particles') {
            transformationStateRef.current = 'particles';
            setCurrentState('particles');
          }
        } else if (transformationTimerRef.current < 11) {
          if (transformationStateRef.current !== 'formingGateway') {
            transformationStateRef.current = 'formingGateway';
            setCurrentState('formingGateway');
          }
        } else if (transformationStateRef.current !== 'traveling' && transformationStateRef.current !== 'gallery') {
          if (transformationStateRef.current !== 'gateway') {
            transformationStateRef.current = 'gateway';
            setCurrentState('gateway');
          }
        }
      } else if (!hasStartedDissolvingRef.current) {
        transformationTimerRef.current = 0;
        if (transformationStateRef.current !== 'sphere') {
          transformationStateRef.current = 'sphere';
          setCurrentState('sphere');
        }
      }

      if (transformationStateRef.current === 'traveling') {
        // Slow down during explosion phase (first 30%), normal speed after
        const currentProgress = journeyProgressRef.current;
        if (currentProgress < 0.30) {
          // Slower during explosion - takes ~3 seconds like gateway formation
          journeyProgressRef.current += deltaTime * 0.1 * 0.30; // ~3 seconds for 30%
        } else {
          // Slower building phase (was 0.06, now 0.03)
          journeyProgressRef.current += deltaTime * 0.03;
        }
        
        if (journeyProgressRef.current >= 1) {
          // Show the character when gallery starts
          if (characterRef.current) {
            characterRef.current.visible = true;
          }
          
          transformationStateRef.current = 'gallery';
          setCurrentState('gallery');
          marbleTransitionRef.current = 0;
        }
      }

      // Marble transition in gallery
      if (transformationStateRef.current === 'gallery' && gridWallsRef.current) {
        marbleTransitionRef.current = Math.min(1, marbleTransitionRef.current + deltaTime * 0.3);
        const progress = marbleTransitionRef.current;

        if (progress > 0 && progress <= 1) {
          gridWallsRef.current.children.forEach(blockGroup => {
            const edges = blockGroup.userData.edges;
            const block = blockGroup.userData.block;

            if (edges && edges.material) {
              edges.material.opacity = Math.max(0, 1 - progress);
            }

            if (block && progress >= 0.5 && !blockGroup.userData.transitionedToMarble) {
              block.material = gridWallsRef.current.userData.polishedBlockMaterial;
              blockGroup.userData.transitionedToMarble = true;
            }
          });

          const fg = gridWallsRef.current.userData.frameGroup;
          if (fg) {
            fg.visible = true;
            const frameOpacity = Math.max(0, Math.min(1, (progress - 0.3) / 0.7));

            fg.children.forEach(frame => {
              const imagePlane = frame.userData.imagePlane;
              const border = frame.userData.border;

              if (imagePlane && imagePlane.material) {
                imagePlane.material.opacity = frameOpacity;
              }
              if (border && border.material) {
                border.material.opacity = frameOpacity;
              }
            });
          }

          lights.gallerySpots.forEach(spot => {
            spot.intensity = 8 * progress;
          });
          lights.galleryAmbient.intensity = progress * 1.2;
        }
      }

      // Particle animation
      if (particlesRef.current) {
        const mesh = particlesRef.current;
        const origPos = mesh.userData.originalPositions;
        const gwPos = mesh.userData.gatewayPositions;

        let dissolveAmount = 0;
        let morphIntensity = 0;
        let gatewayFormation = 0;

        const state = transformationStateRef.current;

        if (state === 'sphere') {
          morphIntensity = scrollProgressRef.current / 100;
        } else if (state === 'dissolving') {
          dissolveAmount = Math.min(transformationTimerRef.current / 5, 1);
        } else if (state === 'particles') {
          dissolveAmount = 1;
        } else if (state === 'formingGateway') {
          const progress = Math.min((transformationTimerRef.current - 8) / 3, 1);
          dissolveAmount = 1 - progress;
          gatewayFormation = progress;
        } else if (state === 'gateway') {
          gatewayFormation = 1;
          if (textMeshRef.current) {
            textMeshRef.current.visible = true;
            const pulse = 1 + Math.sin(time * 2) * 0.05;
            textMeshRef.current.scale.set(4 * pulse, pulse, 1);
          }
        } else if (state === 'traveling') {
          const jp = journeyProgressRef.current;

          if (textMeshRef.current) textMeshRef.current.visible = false;

          // Particle explosion phase (first 30% of journey)
          if (jp < 0.30) {
            const exp = jp / 0.30;
            const mat = tempMatrix.current;
            const pos = tempPosition.current;
            const scl = tempScale.current;

            for (let i = 0; i < gwPos.length; i++) {
              const seed = i * 0.12345;
              const dirX = Math.sin(seed * 12.9898) * 2 - 1;
              const dirY = Math.sin(seed * 78.233) * 2 - 1;
              const dirZ = Math.sin(seed * 37.719) * 2 - 1;
              const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

              pos.set(
                gwPos[i].x + (dirX / len) * exp * 80,
                gwPos[i].y + (dirY / len) * exp * 80,
                gwPos[i].z + (dirZ / len) * exp * 80
              );

              const opacity = Math.max(0.01, 1 - exp * 2);
              scl.set(opacity, opacity, opacity);
              mat.compose(pos, tempQuaternion.current, scl);
              mesh.setMatrixAt(i, mat);
            }
            mesh.instanceMatrix.needsUpdate = true;

            // Camera stays looking at the gateway area during explosion
            if (cameraRef.current) {
              cameraRef.current.position.set(0, 0, 10);
              cameraRef.current.lookAt(0, 0, -10);
              cameraAngleRef.current.horizontal = 0;
            }
          } else {
            // Hide particles after explosion
            const mat = tempMatrix.current;
            const pos = tempPosition.current.set(0, 0, -100);
            const scl = tempScale.current.set(0, 0, 0);
            for (let i = 0; i < origPos.length; i++) {
              mat.compose(pos, tempQuaternion.current, scl);
              mesh.setMatrixAt(i, mat);
            }
            mesh.instanceMatrix.needsUpdate = true;

            // Camera movement during building (after explosion) - moves backwards
            if (cameraRef.current) {
              const buildP = Math.min(1, (jp - 0.30) / 0.70);
              
              // Ease function - smooth movement
              const ease = buildP < 0.5
                ? 2 * buildP * buildP
                : 1 - Math.pow(-2 * buildP + 2, 2) / 2;
              
              // Final position (end further back)
              const endX = 0, endY = -2, endZ = -12;
              // Start closer
              const startZ = -8;
              
              const camZ = startZ + (endZ - startZ) * ease;
              
              cameraRef.current.position.set(endX, endY, camZ);
              cameraRef.current.lookAt(0, -5, 3);
              cameraAngleRef.current.horizontal = 0;
            }
          }

          // Building animation (starts after explosion at 30%)
          if (jp >= 0.30 && gridWallsRef.current) {
            const buildP = Math.min(1, (jp - 0.30) / 0.70);

            gridWallsRef.current.visible = true;

            // Character stays hidden and in position (will appear when gallery starts)
            if (characterRef.current) {
              characterRef.current.position.set(0, -5, 0);
              characterRef.current.visible = false;
            }

            gridWallsRef.current.children.forEach(block => {
              if (!block.userData.randomStart) {
                block.userData.randomStart = Math.random() * 0.5;
                block.userData.randomDuration = 0.15 + Math.random() * 0.2;
              }

              const { randomStart, randomDuration, finalPosition } = block.userData;

              let blockProgress = 0;
              if (buildP >= randomStart && buildP < randomStart + randomDuration) {
                blockProgress = (buildP - randomStart) / randomDuration;
              } else if (buildP >= randomStart + randomDuration) {
                blockProgress = 1;
              }

              if (blockProgress > 0) {
                const eased = blockProgress < 0.5
                  ? 2 * blockProgress * blockProgress
                  : 1 - Math.pow(-2 * blockProgress + 2, 2) / 2;

                block.position.x = finalPosition.x;
                block.position.y = -15 + (finalPosition.y - (-15)) * eased;
                block.position.z = finalPosition.z;
                block.scale.set(eased, eased, eased);
              } else {
                block.scale.set(0, 0, 0);
              }
            });

            scene.background.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x050508), buildP);
          }
        } else if (state === 'gallery') {
          if (textMeshRef.current) textMeshRef.current.visible = false;
          if (gridWallsRef.current) gridWallsRef.current.visible = true;
          scene.background = new THREE.Color(0x050508);

          if (!mesh.userData.hidden) {
            const mat = tempMatrix.current;
            const pos = tempPosition.current.set(0, 0, -100);
            const scl = tempScale.current.set(0, 0, 0);
            for (let i = 0; i < origPos.length; i++) {
              mat.compose(pos, tempQuaternion.current, scl);
              mesh.setMatrixAt(i, mat);
            }
            mesh.instanceMatrix.needsUpdate = true;
            mesh.userData.hidden = true;
          }
        }

        // Sphere morphing
        if (state !== 'traveling' && state !== 'gallery') {
          mesh.userData.hidden = false;
          const mat = tempMatrix.current;
          const pos = tempPosition.current;
          const quat = tempQuaternion.current;
          const scl = tempScale.current.set(1, 1, 1);
          const amp = 1 + morphIntensity * 2;

          for (let i = 0; i < origPos.length; i++) {
            let fx = origPos[i].x, fy = origPos[i].y, fz = origPos[i].z;

            if (morphIntensity > 0) {
              const dist = Math.sqrt(fx * fx + fy * fy + fz * fz);
              const wave = Math.sin(fx * 1.5 + time * 1.3) * 0.3 +
                Math.sin(fy * 1.8 + time * 1.1) * 0.3 +
                Math.sin(fz * 1.6 + time * 1.5) * 0.3 +
                Math.sin(dist * 2.5 + time * 1.8) * 0.4;
              const disp = wave * morphIntensity * 0.4 * amp;
              fx += (fx / dist) * disp;
              fy += (fy / dist) * disp;
              fz += (fz / dist) * disp;
            }

            if (dissolveAmount > 0) {
              const seed = i * 0.12345;
              const rx = Math.sin(seed * 12.9898) * 2 - 1;
              const ry = Math.sin(seed * 78.233) * 2 - 1;
              const rz = Math.sin(seed * 37.719) * 2 - 1;
              const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
              fx = origPos[i].x + (rx / len) * dissolveAmount * 15;
              fy = origPos[i].y + (ry / len) * dissolveAmount * 15;
              fz = origPos[i].z + (rz / len) * dissolveAmount * 15;
            }

            if (gatewayFormation > 0) {
              fx = fx * (1 - gatewayFormation) + gwPos[i].x * gatewayFormation;
              fy = fy * (1 - gatewayFormation) + gwPos[i].y * gatewayFormation;
              fz = fz * (1 - gatewayFormation) + gwPos[i].z * gatewayFormation;
            }

            pos.set(fx, fy, fz);
            mat.compose(pos, quat, scl);
            mesh.setMatrixAt(i, mat);
          }
          mesh.instanceMatrix.needsUpdate = true;
        }

        if (state === 'gateway') {
          mesh.rotation.x += deltaTime * 0.6;
          mesh.rotation.y += deltaTime * 0.06;
        } else {
          mesh.rotation.y += deltaTime * 0.06;
        }
      }

      // Character movement - FASTER SPEED
      if (characterRef.current && transformationStateRef.current === 'gallery') {
        const char = characterRef.current;
        const keys = keysPressed.current;
        const vel = characterVelocity.current;

        const acc = 0.015, fric = 0.92, maxSpd = 0.15;

        const fwd = new THREE.Vector3(
          Math.sin(cameraAngleRef.current.horizontal), 0,
          Math.cos(cameraAngleRef.current.horizontal)
        );
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

        // Keyboard input
        if (keys.w) { vel.x += fwd.x * acc; vel.z += fwd.z * acc; }
        if (keys.s) { vel.x -= fwd.x * acc; vel.z -= fwd.z * acc; }
        if (keys.a) { vel.x += right.x * acc; vel.z += right.z * acc; }
        if (keys.d) { vel.x -= right.x * acc; vel.z -= right.z * acc; }
        if (keys.space) vel.y += acc;
        if (keys.shift) vel.y -= acc;

        // Joystick input (mobile)
        if (joystickRef.current.active) {
          const joyX = joystickRef.current.currentX - joystickRef.current.startX;
          const joyY = joystickRef.current.currentY - joystickRef.current.startY;
          const maxJoyDist = 40;
          const normalizedX = Math.max(-1, Math.min(1, joyX / maxJoyDist));
          const normalizedY = Math.max(-1, Math.min(1, joyY / maxJoyDist));
          
          // Forward/backward (Y axis of joystick)
          vel.x -= fwd.x * acc * normalizedY * 1.5;
          vel.z -= fwd.z * acc * normalizedY * 1.5;
          // Left/right (X axis of joystick)
          vel.x -= right.x * acc * normalizedX * 1.5;
          vel.z -= right.z * acc * normalizedX * 1.5;
        }

        vel.x *= fric; vel.y *= fric; vel.z *= fric;

        const spd = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (spd > maxSpd) { vel.x = (vel.x / spd) * maxSpd; vel.z = (vel.z / spd) * maxSpd; }
        vel.y = Math.max(-maxSpd, Math.min(maxSpd, vel.y));

        let newX = char.position.x + vel.x;
        let newY = char.position.y + vel.y;
        let newZ = char.position.z + vel.z;

        const margin = 3;
        const charRadius = 1;
        newX = Math.max(-ROOM_WIDTH / 2 + margin, Math.min(ROOM_WIDTH / 2 - margin, newX));
        newY = Math.max(-14 + charRadius, Math.min(14 - charRadius, newY));
        newZ = Math.max(-ROOM_DEPTH / 2 + margin, Math.min(ROOM_DEPTH / 2 - margin, newZ));

        char.position.set(newX, newY, newZ);

        char.userData.orb.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
        char.userData.ring.rotation.z += deltaTime * 3;
        char.userData.light.intensity = 3 + Math.sin(time * 2) * 0.8;

        // Frame proximity detection
        if (gridWallsRef.current && gridWallsRef.current.userData.frameGroup) {
          const frameGroupObj = gridWallsRef.current.userData.frameGroup;
          let closestFrame = null;
          let closestDist = Infinity;
          const interactionDist = 4;

          frameGroupObj.children.forEach(frame => {
            const framePos = frame.position;
            const dx = char.position.x - framePos.x;
            const dy = char.position.y - framePos.y;
            const dz = char.position.z - framePos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const glowMat = frame.userData.glowMaterial;
            if (glowMat) {
              if (dist < interactionDist) {
                const intensity = 1 - (dist / interactionDist);
                glowMat.opacity += (intensity * 0.4 - glowMat.opacity) * 0.15;
                const pulse = 1 + Math.sin(time * 4) * 0.02 * intensity;
                frame.scale.set(pulse, pulse, pulse);

                if (dist < closestDist) {
                  closestDist = dist;
                  closestFrame = frame;
                }
              } else {
                glowMat.opacity *= 0.85;
                if (glowMat.opacity < 0.01) glowMat.opacity = 0;
                frame.scale.set(1, 1, 1);
              }
            }
          });

          if (closestFrame !== nearbyFrameRef.current) {
            nearbyFrameRef.current = closestFrame;
            setNearbyFrame(closestFrame ? closestFrame.userData.frameIndex : null);
          }
        }
      }

      // Camera controller
      if (cameraRef.current) {
        const state = transformationStateRef.current;

        if (state === 'gallery' && characterRef.current) {
          const char = characterRef.current;
          const camDist = 8, camH = 3;

          const targetPosX = char.position.x - Math.sin(cameraAngleRef.current.horizontal) * camDist;
          const targetPosY = char.position.y + camH;
          const targetPosZ = char.position.z - Math.cos(cameraAngleRef.current.horizontal) * camDist;

          const camMargin = 2;
          const clampedPosX = Math.max(-ROOM_WIDTH / 2 + camMargin, Math.min(ROOM_WIDTH / 2 - camMargin, targetPosX));
          const clampedPosY = Math.max(-14 + camMargin, Math.min(14 - camMargin, targetPosY));
          const clampedPosZ = Math.max(-ROOM_DEPTH / 2 + camMargin, Math.min(ROOM_DEPTH / 2 - camMargin, targetPosZ));

          // Smooth camera follow
          cameraRef.current.position.x += (clampedPosX - cameraRef.current.position.x) * 0.1;
          cameraRef.current.position.y += (clampedPosY - cameraRef.current.position.y) * 0.1;
          cameraRef.current.position.z += (clampedPosZ - cameraRef.current.position.z) * 0.1;

          const targetLookX = char.position.x + Math.sin(cameraAngleRef.current.horizontal) * 3;
          const targetLookY = char.position.y;
          const targetLookZ = char.position.z + Math.cos(cameraAngleRef.current.horizontal) * 3;

          cameraRef.current.lookAt(targetLookX, targetLookY, targetLookZ);

        } else if (state !== 'traveling') {
          const progress = scrollProgressRef.current / 100;
          const targetDist = 40 - progress * 37;
          const rad = Math.abs(targetDist - (-10));

          const targetPosX = rad * Math.sin(cameraAngleRef.current.horizontal);
          let targetPosY = rad * Math.sin(cameraAngleRef.current.vertical);
          const targetPosZ = rad * Math.cos(cameraAngleRef.current.horizontal) - 10;

          // Clamp camera Y to stay above floor
          const minCameraY = -13;
          targetPosY = Math.max(minCameraY, targetPosY);

          cameraRef.current.position.x += (targetPosX - cameraRef.current.position.x) * 0.1;
          cameraRef.current.position.y += (targetPosY - cameraRef.current.position.y) * 0.1;
          cameraRef.current.position.z += (targetPosZ - cameraRef.current.position.z) * 0.1;

          cameraRef.current.lookAt(0, 0, -10);
        }
      }

      // Lighting animation
      const galleryLightProgress = transformationStateRef.current === 'gallery' ? marbleTransitionRef.current : 0;

      if (galleryLightProgress > 0) {
        const sphereLightIntensity = Math.max(0, 1 - galleryLightProgress);
        
        lights.key.intensity = (3.5 + Math.sin(time * 0.5) * 0.3) * sphereLightIntensity;
        lights.fill.intensity = 2 * sphereLightIntensity;
        lights.rim.intensity = (3.5 + Math.sin(time * 0.7) * 0.3) * sphereLightIntensity;
        lights.front.intensity = (2.5 + Math.sin(time * 0.6) * 0.3) * sphereLightIntensity;
        
        lights.ambient.intensity = 0.8 + galleryLightProgress * 1.5;
        lights.galleryAmbient.intensity = galleryLightProgress * 1.2;
        
        lights.gallerySpots.forEach((spot, i) => {
          spot.intensity = 8 * galleryLightProgress * (1 + Math.sin(time * 0.3 + i) * 0.1);
        });
      } else {
        lights.key.intensity = 3.5 + Math.sin(time * 0.5) * 0.3;
        lights.fill.intensity = 2 + Math.sin(time * 0.8) * 0.2;
        lights.rim.intensity = 3.5 + Math.sin(time * 0.7) * 0.3;
        lights.front.intensity = 2.5 + Math.sin(time * 0.6) * 0.3;
      }

      scene.userData.stars.rotation.y += deltaTime * 0.003;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStartCanvas);
      window.removeEventListener('touchmove', handleTouchMoveCanvas);
      window.removeEventListener('touchend', handleTouchEndCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      disposables.geometries.forEach(g => g.dispose());
      disposables.materials.forEach(m => m.dispose());
      disposables.textures.forEach(t => t.dispose());

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Scroll handler (with touch support for mobile)
  useEffect(() => {
    let animationFrame;
    let targetProgress = 0;
    let touchStartY = 0;

    const handleScroll = (e) => {
      e.preventDefault();
      if (['traveling', 'gallery', 'gateway'].includes(transformationStateRef.current)) return;
      targetProgress = Math.max(0, Math.min(100, targetProgress + e.deltaY * 0.02));
    };

    // Touch handlers for mobile scroll on sphere phase
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (['traveling', 'gallery', 'gateway'].includes(transformationStateRef.current)) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      targetProgress = Math.max(0, Math.min(100, targetProgress + deltaY * 0.05));
      touchStartY = touchY;
    };

    const animateProgress = () => {
      setScrollProgress(prev => {
        const newProgress = prev + (targetProgress - prev) * 0.1;
        scrollProgressRef.current = newProgress;
        return newProgress;
      });
      animationFrame = requestAnimationFrame(animateProgress);
    };

    animateProgress();
    window.addEventListener('wheel', handleScroll, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  // ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selectedFrame) {
        setSelectedFrame(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedFrame]);

  // Mobile detection - shows mobile UI on small screens
  useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth <= 1024;
      setIsMobile(isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Background music
  useEffect(() => {
    let currentUrlIndex = 0;
    let hasStarted = false;
    
    // Create audio element
    const audio = new Audio();
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    // Try to load the audio source
    const tryLoadAudio = () => {
      if (currentUrlIndex < MUSIC_URLS.length) {
        console.log('Trying audio source:', MUSIC_URLS[currentUrlIndex]);
        audio.src = MUSIC_URLS[currentUrlIndex];
        audio.load();
      } else {
        console.log('All audio sources failed');
      }
    };

    // Handle load errors - try next source
    const handleError = () => {
      console.log('Audio source failed, trying next...');
      currentUrlIndex++;
      tryLoadAudio();
    };

    audio.addEventListener('error', handleError);

    // Start with first URL
    tryLoadAudio();

    // Start music on first user interaction
    const handleFirstInteraction = () => {
      if (!hasStarted && audioRef.current) {
        audioRef.current.play()
          .then(() => {
            hasStarted = true;
            setMusicStarted(true);
            console.log('Music started playing');
            // Remove listeners after successful start
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('mousedown', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
            window.removeEventListener('touchstart', handleFirstInteraction);
          })
          .catch((err) => {
            console.log('Audio play failed:', err);
            // Try next source on play failure
            currentUrlIndex++;
            tryLoadAudio();
          });
      }
    };

    // Add interaction listeners
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('mousedown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      audio.removeEventListener('error', handleError);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Handle music play/pause when toggle button is clicked
  useEffect(() => {
    if (audioRef.current) {
      if (isMusicPlaying && musicStarted) {
        audioRef.current.play().catch(() => {});
      } else if (!isMusicPlaying) {
        audioRef.current.pause();
      }
    }
  }, [isMusicPlaying, musicStarted]);

  // Toggle music function
  const toggleMusic = useCallback(() => {
    // If music hasn't started yet, try to start it
    if (!musicStarted && audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setMusicStarted(true);
          setIsMusicPlaying(true);
        })
        .catch(() => {});
    } else {
      setIsMusicPlaying(prev => !prev);
    }
  }, [musicStarted]);

  const handleDownload = useCallback((resolution) => {
    if (!selectedFrame) return;

    if (selectedFrame.imageUrl) {
      window.open(selectedFrame.imageUrl, '_blank');
      return;
    }

    if (!selectedFrame.texture) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const resolutions = {
      'small': { width: 540, height: 960 },
      'medium': { width: 1080, height: 1920 },
      'large': { width: 2160, height: 3840 }
    };

    const res = resolutions[resolution] || resolutions.medium;
    canvas.width = res.width;
    canvas.height = res.height;

    const image = selectedFrame.texture.image;
    if (image) {
      ctx.drawImage(image, 0, 0, res.width, res.height);
      const link = document.createElement('a');
      link.download = `artwork-${selectedFrame.index + 1}-${resolution}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, [selectedFrame]);

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {scrollProgress < 10 && currentState === 'sphere' && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Arial, sans-serif',
          textAlign: 'center', pointerEvents: 'none',
          animation: 'fadeIn 1s ease-in'
        }}>
          {isMobile ? 'Touch and drag to orbit • Swipe up to approach' : 'Click and drag to orbit • Scroll to approach'}
        </div>
      )}

      {currentState === 'gallery' && !selectedFrame && !isMobile && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Arial, sans-serif',
          textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: 5
        }}>
          WASD: Move • Space: Up • Shift: Down • Drag: Rotate{nearbyFrame !== null && ' • Click to view artwork'}
        </div>
      )}

      {/* Mobile Joystick Control */}
      {isMobile && currentState === 'gallery' && !selectedFrame && (
        <>
          {/* Joystick Area - Left Side */}
          <div
            style={{
              position: 'absolute',
              left: 20,
              bottom: 100,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              touchAction: 'none',
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              joystickRef.current = {
                active: true,
                startX: centerX,
                startY: centerY,
                currentX: touch.clientX,
                currentY: touch.clientY,
              };
            }}
            onTouchMove={(e) => {
              if (joystickRef.current.active) {
                const touch = e.touches[0];
                joystickRef.current.currentX = touch.clientX;
                joystickRef.current.currentY = touch.clientY;
              }
            }}
            onTouchEnd={() => {
              joystickRef.current.active = false;
            }}
          >
            {/* Joystick Knob */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.6)',
                transform: joystickRef.current.active
                  ? `translate(calc(-50% + ${Math.max(-40, Math.min(40, joystickRef.current.currentX - joystickRef.current.startX))}px), calc(-50% + ${Math.max(-40, Math.min(40, joystickRef.current.currentY - joystickRef.current.startY))}px))`
                  : 'translate(-50%, -50%)',
                transition: joystickRef.current.active ? 'none' : 'transform 0.2s ease-out',
              }}
            />
          </div>

          {/* Up/Down Buttons - Right Side */}
          <div style={{
            position: 'absolute',
            right: 20,
            bottom: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {/* Up Button */}
            <button
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
              }}
              onTouchStart={() => {
                keysPressed.current.space = true;
              }}
              onTouchEnd={() => {
                keysPressed.current.space = false;
              }}
            >
              ↑
            </button>
            {/* Down Button */}
            <button
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
              }}
              onTouchStart={() => {
                keysPressed.current.shift = true;
              }}
              onTouchEnd={() => {
                keysPressed.current.shift = false;
              }}
            >
              ↓
            </button>
          </div>

          {/* Camera rotation area - center/right side of screen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '70%',
              touchAction: 'none',
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              touchCameraRef.current = {
                active: true,
                lastX: touch.clientX,
                lastY: touch.clientY,
              };
            }}
            onTouchMove={(e) => {
              if (touchCameraRef.current.active) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchCameraRef.current.lastX;
                const deltaY = touch.clientY - touchCameraRef.current.lastY;
                
                cameraAngleRef.current.horizontal -= deltaX * 0.005;
                cameraAngleRef.current.vertical = Math.max(-Math.PI / 12, Math.min(Math.PI / 4,
                  cameraAngleRef.current.vertical - deltaY * 0.003));
                
                touchCameraRef.current.lastX = touch.clientX;
                touchCameraRef.current.lastY = touch.clientY;
              }
            }}
            onTouchEnd={() => {
              touchCameraRef.current.active = false;
            }}
          />

          {/* Mobile hint */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            Joystick: Move • Arrows: Up/Down • Touch right side: Look{nearbyFrame !== null && ' • Tap frame to view'}
          </div>
        </>
      )}

      {currentState === 'gallery' && nearbyFrame !== null && !selectedFrame && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.9)', fontSize: 18, fontFamily: 'Arial, sans-serif',
          textAlign: 'center', pointerEvents: 'none',
          textShadow: '0 0 10px rgba(68, 136, 255, 0.8), 0 0 20px rgba(68, 136, 255, 0.5)'
        }}>
          {isMobile ? 'Tap to view' : 'Click to view'}
        </div>
      )}

      {selectedFrame && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedFrame(null);
          }}
        >
          <button
            onClick={() => setSelectedFrame(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
              color: 'white', fontSize: 24, width: 50, height: 50,
              borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
          >
            ✕
          </button>

          <div style={{
            maxWidth: '80vw', maxHeight: '70vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 30
          }}>
            {selectedFrame.imageUrl ? (
              <img
                src={selectedFrame.imageUrl}
                alt={`Artwork ${selectedFrame.index + 1}`}
                style={{
                  maxWidth: '100%', maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                  boxShadow: '0 0 40px rgba(68, 136, 255, 0.3)'
                }}
              />
            ) : (
              <div style={{
                width: 300, height: 500,
                background: 'linear-gradient(135deg, #4a5568, #667eea)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 24
              }}>
                Artwork #{selectedFrame.index + 1}
              </div>
            )}
          </div>

          <div style={{
            color: 'white', fontSize: 20, marginBottom: 20,
            fontFamily: 'Arial, sans-serif'
          }}>
            Artwork #{selectedFrame.index + 1}
          </div>

          <div style={{ display: 'flex', gap: 15 }}>
            {['small', 'medium', 'large'].map(size => (
              <button
                key={size}
                onClick={() => handleDownload(size)}
                style={{
                  background: 'rgba(68, 136, 255, 0.2)',
                  border: '1px solid rgba(68, 136, 255, 0.5)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'Arial, sans-serif',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(68, 136, 255, 0.4)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(68, 136, 255, 0.2)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{size}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  {size === 'small' ? '540×960' : size === 'medium' ? '1080×1920' : '2160×3840'}
                </span>
              </button>
            ))}
          </div>

          <div style={{
            position: 'absolute', bottom: 20,
            color: 'rgba(255,255,255,0.5)', fontSize: 12,
            fontFamily: 'Arial, sans-serif'
          }}>
            Press ESC or click outside to close
          </div>
        </div>
      )}

      {/* Music toggle button */}
      <button
        onClick={toggleMusic}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isMusicPlaying ? 'rgba(40, 80, 150, 0.4)' : 'rgba(100, 100, 100, 0.2)',
          border: `1px solid ${isMusicPlaying ? 'rgba(40, 80, 150, 0.6)' : 'rgba(150, 150, 150, 0.3)'}`,
          color: 'rgba(255, 255, 255, 0.8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.background = isMusicPlaying ? 'rgba(40, 80, 150, 0.6)' : 'rgba(100, 100, 100, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = isMusicPlaying ? 'rgba(40, 80, 150, 0.4)' : 'rgba(100, 100, 100, 0.2)';
        }}
        title={isMusicPlaying ? 'Mute music' : 'Play music'}
      >
        {isMusicPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" opacity="0.4"/>
            <circle cx="6" cy="18" r="3" opacity="0.4"/>
            <circle cx="18" cy="16" r="3" opacity="0.4"/>
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5"/>
          </svg>
        )}
      </button>

      {/* Debug info - moved down to not overlap with music button */}
      <div style={{
        position: 'absolute', top: 60, right: 20, color: 'rgba(255,255,255,0.8)',
        fontSize: 14, fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)',
        padding: '10px 15px', borderRadius: 5
      }}>
        {Math.round(scrollProgress)}% • {currentState} • {isMobile ? '📱' : '🖥️'}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ArtGallery;
