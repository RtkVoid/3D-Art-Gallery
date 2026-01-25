import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Constants (easier to tune)
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
const FRAME_VERTICAL_SPACING = 5.2; // Increased spacing between rows
const FRAME_TOP_OFFSET = 2; // Push frames down from ceiling

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

  // Frame interaction state
  const [nearbyFrame, setNearbyFrame] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const nearbyFrameRef = useRef(null);

  // Unified camera state - stores actual current values
  const cameraStateRef = useRef({
    posX: 0, posY: 0, posZ: 40,
    lookX: 0, lookY: 0, lookZ: -10,
    orbitAngle: 0
  });

  // Reusable objects for performance (avoid creating in loops)
  const tempMatrix = useRef(new THREE.Matrix4());
  const tempPosition = useRef(new THREE.Vector3());
  const tempScale = useRef(new THREE.Vector3());
  const tempQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset all refs on mount to ensure clean state after refresh
    cameraAngleRef.current = { horizontal: 0, vertical: 0 };
    transformationStateRef.current = 'sphere';
    transformationTimerRef.current = 0;
    hasStartedDissolvingRef.current = false;
    journeyProgressRef.current = 0;
    scrollProgressRef.current = 0;
    marbleTransitionRef.current = 0;
    isDraggingRef.current = false;
    characterVelocity.current = { x: 0, y: 0, z: 0 };
    keysPressed.current = { w: false, a: false, s: false, d: false, space: false, shift: false };
    cameraStateRef.current = {
      posX: 0, posY: 0, posZ: 40,
      lookX: 0, lookY: 0, lookZ: -10,
      orbitAngle: 0
    };

    // Track all disposables for cleanup
    const disposables = {
      geometries: [],
      materials: [],
      textures: []
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 10, 50);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 40);
    camera.lookAt(0, 0, -10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false // Disable stencil buffer (not needed)
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap at 1.5 for better performance
    renderer.sortObjects = false; // Disable for better performance (we don't need sorting)
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create instanced sphere particles with procedural metal material
    const sphereGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    disposables.geometries.push(sphereGeometry);

    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x8899bb,
      metalness: 0.95,
      roughness: 0.15,
      envMapIntensity: 1.5
    });
    disposables.materials.push(sphereMaterial);

    const instancedMesh = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, PARTICLE_COUNT);
    instancedMesh.position.z = -10;

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

    // Create ENTER text sprite
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

    // Lighting
    const mainLight = new THREE.DirectionalLight(0x6688ff, 4);
    mainLight.position.set(0, 20, -10);
    scene.add(mainLight);

    const pointLight1 = new THREE.PointLight(0x6688ff, 3, 50);
    pointLight1.position.set(0, 10, -10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x6644ff, 2.5, 50);
    pointLight2.position.set(5, 5, -8);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x8899ff, 2, 40);
    pointLight3.position.set(-5, 5, -8);
    scene.add(pointLight3);

    const rimLight = new THREE.PointLight(0x9999ff, 3, 50);
    rimLight.position.set(0, 0, -15);
    scene.add(rimLight);

    const sphereGlow = new THREE.PointLight(0x88aaff, 4, 50);
    sphereGlow.position.set(0, 0, -10);
    scene.add(sphereGlow);

    const ambientLight = new THREE.AmbientLight(0xaabbcc, 3.5); // Increased brightness and warmer color
    scene.add(ambientLight);

    // Additional gallery lights for better artwork illumination
    const galleryLight1 = new THREE.PointLight(0xffffff, 5, 80);
    galleryLight1.position.set(0, 10, 0);
    scene.add(galleryLight1);

    const galleryLight2 = new THREE.PointLight(0xffffff, 4, 60);
    galleryLight2.position.set(20, 8, 0);
    scene.add(galleryLight2);

    const galleryLight3 = new THREE.PointLight(0xffffff, 4, 60);
    galleryLight3.position.set(-20, 8, 0);
    scene.add(galleryLight3);

    const galleryLight4 = new THREE.PointLight(0xffffff, 4, 60);
    galleryLight4.position.set(0, 8, 20);
    scene.add(galleryLight4);

    const galleryLight5 = new THREE.PointLight(0xffffff, 4, 60);
    galleryLight5.position.set(0, 8, -20);
    scene.add(galleryLight5);

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

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    disposables.geometries.push(floorGeometry);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.9,
      roughness: 0.1
    });
    disposables.materials.push(floorMaterial);

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -15, -10);
    scene.add(floor);

    // Background walls
    const wallGeometry = new THREE.PlaneGeometry(100, 60);
    disposables.geometries.push(wallGeometry);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.95,
      side: THREE.DoubleSide
    });
    disposables.materials.push(wallMaterial);

    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 15, -60);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-50, 15, -10);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(50, 15, -10);
    scene.add(rightWall);

    const gridHelper = new THREE.GridHelper(100, 50, 0x222244, 0x111122);
    gridHelper.position.set(0, -14.99, -10);
    scene.add(gridHelper);

    // Grid walls for gallery
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

    // Create marble texture
    const createMarbleTexture = () => {
      const marbleCanvas = document.createElement('canvas');
      marbleCanvas.width = 512;
      marbleCanvas.height = 512;
      const marbleCtx = marbleCanvas.getContext('2d');

      marbleCtx.fillStyle = '#0a0a0a';
      marbleCtx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 40; i++) {
        marbleCtx.strokeStyle = `rgba(${20 + Math.random() * 30}, ${25 + Math.random() * 35}, ${35 + Math.random() * 40}, ${0.15 + Math.random() * 0.25})`;
        marbleCtx.lineWidth = 1 + Math.random() * 3;
        marbleCtx.beginPath();

        let x = Math.random() * 512;
        let y = Math.random() * 512;
        marbleCtx.moveTo(x, y);

        for (let j = 0; j < 15; j++) {
          x += (Math.random() - 0.5) * 80;
          y += (Math.random() - 0.5) * 80;
          marbleCtx.lineTo(x, y);
        }
        marbleCtx.stroke();
      }

      const imageData = marbleCtx.getImageData(0, 0, 512, 512);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 10;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
      }
      marbleCtx.putImageData(imageData, 0, 0);

      return new THREE.CanvasTexture(marbleCanvas);
    };

    const marbleTexture = createMarbleTexture();
    marbleTexture.wrapS = THREE.RepeatWrapping;
    marbleTexture.wrapT = THREE.RepeatWrapping;
    marbleTexture.repeat.set(2, 2);
    disposables.textures.push(marbleTexture);

    const marbleMaterial = new THREE.MeshStandardMaterial({
      map: marbleTexture,
      color: 0x1a1a1a,
      roughness: 0.3,
      metalness: 0.7,
      envMapIntensity: 1.2
    });
    disposables.materials.push(marbleMaterial);

    const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
    disposables.geometries.push(edgesGeometry);

    const createBlock = (x, y, z) => {
      const block = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
      disposables.materials.push(block.material);

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
        edges: edges
      };

      group.position.set(x, -15, z);
      group.scale.set(0, 0, 0);

      return group;
    };

    const allBlocks = [];

    // Build walls layer by layer
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

    // Add ceiling
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
    gridWalls.userData.marbleMaterial = marbleMaterial;

    // Create image frames on walls
    const frameGroup = new THREE.Group();
    frameGroup.visible = false;

    const wallWidth = ROOM_WIDTH - 4;
    const wallHeight = ROOM_HEIGHT - 4;
    const spacingX = wallWidth / (FRAME_COLS - 1);
    const spacingY = FRAME_VERTICAL_SPACING; // Use our new constant instead of calculating

    const frameGeometry = new THREE.PlaneGeometry(FRAME_WIDTH, FRAME_HEIGHT);
    disposables.geometries.push(frameGeometry);

    const frameBorderGeometry = new THREE.PlaneGeometry(FRAME_WIDTH + 0.2, FRAME_HEIGHT + 0.2);
    disposables.geometries.push(frameBorderGeometry);

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x444444,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0
    });
    disposables.materials.push(frameMaterial);

    const frameBorderMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.6,
      metalness: 0.8,
      emissive: 0x222222,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0
    });
    disposables.materials.push(frameBorderMaterial);

    const createImageFrame = (x, y, z, rotationY = 0, frameIndex = 0) => {
      const frameContainer = new THREE.Group();

      // Clone border material so each frame can fade independently
      const borderMat = frameBorderMaterial.clone();
      disposables.materials.push(borderMat);
      const border = new THREE.Mesh(frameBorderGeometry, borderMat);
      frameContainer.add(border);

      const imagePlaneMaterial = frameMaterial.clone();
      disposables.materials.push(imagePlaneMaterial);

      const imagePlane = new THREE.Mesh(frameGeometry, imagePlaneMaterial);
      imagePlane.position.z = 0.01;
      frameContainer.add(imagePlane);

      // Create glow effect (initially invisible)
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
      glow.position.z = -0.02; // Behind the frame
      frameContainer.add(glow);

      frameContainer.position.set(x, y, z);
      frameContainer.rotation.y = rotationY;

      frameContainer.userData = {
        imagePlane: imagePlane,
        border: border,
        glow: glow,
        glowMaterial: glowMaterial,
        frameIndex: frameIndex,
        imageUrl: null, // Will be set when loading images
        originalScale: { x: 1, y: 1, z: 1 }
      };

      return frameContainer;
    };

    let frameIndex = 0;

    const startX = -wallWidth / 2;
    const startY = wallHeight / 2 - FRAME_TOP_OFFSET; // Push down from ceiling

    // Back wall
    const backWallZ = -ROOM_DEPTH / 2 + 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        // Skip first and last columns (corner frames on all rows)
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const x = startX + col * spacingX;
        const y = startY - row * spacingY;
        frameGroup.add(createImageFrame(x, y, backWallZ, 0, frameIndex++));
      }
    }

    // Front wall
    const frontWallZ = ROOM_DEPTH / 2 - 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        // Skip first and last columns (corner frames on all rows)
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const x = startX + col * spacingX;
        const y = startY - row * spacingY;
        frameGroup.add(createImageFrame(x, y, frontWallZ, Math.PI, frameIndex++));
      }
    }

    // Left wall
    const leftWallX = -ROOM_WIDTH / 2 + 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        // Skip first and last columns (corner frames on all rows)
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const z = startX + col * spacingX;
        const y = startY - row * spacingY;
        frameGroup.add(createImageFrame(leftWallX, y, z, Math.PI / 2, frameIndex++));
      }
    }

    // Right wall
    const rightWallX = ROOM_WIDTH / 2 - 1.2;
    for (let row = 0; row < FRAME_ROWS; row++) {
      for (let col = 0; col < FRAME_COLS; col++) {
        // Skip first and last columns (corner frames on all rows)
        if (col === 0 || col === FRAME_COLS - 1) continue;
        const z = startX + col * spacingX;
        const y = startY - row * spacingY;
        frameGroup.add(createImageFrame(rightWallX, y, z, -Math.PI / 2, frameIndex++));
      }
    }

    scene.add(frameGroup);
    gridWalls.userData.frameGroup = frameGroup;
    scene.userData.frameGroup = frameGroup;

    // Character
    const character = new THREE.Group();

    const orbGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    disposables.geometries.push(orbGeometry);

    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    disposables.materials.push(orbMaterial);

    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
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
    character.add(ring);

    character.position.set(0, -12, 0);
    character.visible = false;
    character.userData = { orb, ring };
    scene.add(character);
    characterRef.current = character;

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
        cameraAngleRef.current.vertical = Math.max(-Math.PI / 4, Math.min(Math.PI / 4,
          cameraAngleRef.current.vertical - (e.clientY - lastMouseRef.current.y) * 0.005));
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = (e) => {
      const shouldShowEnter = !loadingProgress.isLoading || loadingProgress.total === 0;
      if (transformationStateRef.current === 'gateway' && textMeshRef.current && shouldShowEnter) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        if (raycaster.intersectObject(textMeshRef.current).length > 0) {
          console.log('=== ENTER CLICKED - Starting traveling ===');
          console.log('Camera position at start:', cameraRef.current?.position.x, cameraRef.current?.position.y, cameraRef.current?.position.z);
          transformationStateRef.current = 'traveling';
          setCurrentState('traveling');
          journeyProgressRef.current = 0;

          // Snapshot current camera state for smooth transition
          if (cameraRef.current) {
            cameraStateRef.current.posX = cameraRef.current.position.x;
            cameraStateRef.current.posY = cameraRef.current.position.y;
            cameraStateRef.current.posZ = cameraRef.current.position.z;
            cameraStateRef.current.orbitAngle = cameraAngleRef.current.horizontal;
          }
          return;
        }
      }

      // Handle frame click in gallery mode
      if (transformationStateRef.current === 'gallery' && nearbyFrameRef.current) {
        // Use raycaster to check if user actually clicked on the frame
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        // Check if the click intersects with the nearby frame
        const intersects = raycaster.intersectObject(nearbyFrameRef.current, true);

        if (intersects.length > 0) {
          // Get the frame data and open modal
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation loop
    let lastTime = performance.now();
    let animationFrameId = null;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta to prevent jumps
      lastTime = currentTime;

      const time = currentTime * 0.001;

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
        journeyProgressRef.current += deltaTime * 0.03;
        // console.log('Journey progress:', journeyProgressRef.current.toFixed(3)); // DISABLED for performance
        if (journeyProgressRef.current >= 1) {
          console.log('=== TRANSITIONING TO GALLERY ===');
          transformationStateRef.current = 'gallery';
          setCurrentState('gallery');
          marbleTransitionRef.current = 0;
        }
      }

      // Wall transition to marble in gallery mode - OPTIMIZED
      if (transformationStateRef.current === 'gallery' && gridWallsRef.current) {
        const wasTransitioning = marbleTransitionRef.current < 1;
        marbleTransitionRef.current = Math.min(1, marbleTransitionRef.current + deltaTime * 0.3);

        const transitionProgress = marbleTransitionRef.current;

        // OPTIMIZATION: Only update when actually transitioning
        if (wasTransitioning && transitionProgress > 0) {
          const isComplete = transitionProgress >= 1;

          // Transition wall blocks to marble
          gridWallsRef.current.children.forEach(blockGroup => {
            const edges = blockGroup.userData.edges;
            const block = blockGroup.userData.block;

            if (edges && edges.material) {
              edges.material.opacity = Math.max(0, 1 - transitionProgress);
            }

            // OPTIMIZATION: Only clone material once at the transition point, not every frame
            if (block && transitionProgress >= 0.5 && !block.userData.transitionedToMarble) {
              block.material = gridWallsRef.current.userData.marbleMaterial;
              block.userData.transitionedToMarble = true;
            }
          });

          // Fade in frames (start at 30% of transition, fully visible by 100%)
          const frameGroup = gridWallsRef.current.userData.frameGroup;
          if (frameGroup) {
            frameGroup.visible = true;
            const frameOpacity = Math.max(0, Math.min(1, (transitionProgress - 0.3) / 0.7));

            frameGroup.children.forEach(frame => {
              const imagePlane = frame.userData.imagePlane;
              const border = frame.userData.border;

              if (imagePlane && imagePlane.material) {
                imagePlane.material.opacity = frameOpacity;
              }
              if (border && border.material) {
                border.material.opacity = frameOpacity;
              }
            });

            // OPTIMIZATION: If transition is complete, stop updating
            if (isComplete) {
              // Mark as complete so we don't run this expensive code anymore
              gridWallsRef.current.userData.transitionComplete = true;
            }
          }
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
          // Show ENTER button: always show if no images to load, or if loading is complete
          const shouldShow = loadingProgress.total === 0 || !loadingProgress.isLoading;
          if (textMeshRef.current && shouldShow) {
            textMeshRef.current.visible = true;
            const pulse = 1 + Math.sin(time * 2) * 0.05;
            textMeshRef.current.scale.set(4 * pulse, pulse, 1);
          } else if (textMeshRef.current) {
            textMeshRef.current.visible = false;
          }
        } else if (state === 'traveling') {
          const jp = journeyProgressRef.current;

          if (textMeshRef.current) textMeshRef.current.visible = false;

          if (jp < 0.3) {
            // console.log('PARTICLE EXPLOSION - jp:', jp.toFixed(3), 'camZ:', cameraRef.current?.position.z.toFixed(2), 'camY:', cameraRef.current?.position.y.toFixed(2)); // DISABLED for performance
            const exp = jp / 0.3;
            const mat = tempMatrix.current;
            const pos = tempPosition.current;
            const scl = tempScale.current;

            for (let i = 0; i < origPos.length; i++) {
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

            // Camera stays still during particle explosion, looking at sphere center
            if (cameraRef.current) {
              cameraRef.current.lookAt(0, 0, -10);
            }
          }

          // Build walls
          if (jp >= 0.3 && jp < 1.0 && gridWallsRef.current) {
            const buildP = Math.min(1, (jp - 0.3) / 0.65);

            // console.log('WALL BUILD - buildP:', buildP.toFixed(2), 'camZ:', cameraRef.current?.position.z.toFixed(2), 'camY:', cameraRef.current?.position.y.toFixed(2), 'shouldBeStill:', buildP < 0.2); // DISABLED for performance

            // Hide particles
            const mat = tempMatrix.current;
            const pos = tempPosition.current.set(0, 0, -100);
            const scl = tempScale.current.set(0, 0, 0);
            for (let i = 0; i < origPos.length; i++) {
              mat.compose(pos, tempQuaternion.current, scl);
              mesh.setMatrixAt(i, mat);
            }
            mesh.instanceMatrix.needsUpdate = true;

            gridWallsRef.current.visible = true;

            // *** CAMERA CONTROL DURING WALL BUILDING - RIGHT HERE ***
            if (cameraRef.current) {
              // First 20% of wall building: camera stays still
              // Then camera moves back
              const stillPhase = 0.2;

              // ALWAYS set position explicitly (don't let it drift)
              const startZ = 3;
              const endZ = -8;
              const startY = 0;
              const endY = -2;

              if (buildP < stillPhase) {
                // Camera stays at starting position
                cameraRef.current.position.x = 0;
                cameraRef.current.position.y = startY;
                cameraRef.current.position.z = startZ;
                cameraRef.current.lookAt(0, 0, -10);
              } else {
                // Camera moves back
                const moveProgress = (buildP - stillPhase) / (1 - stillPhase);
                const ease = moveProgress < 0.5
                  ? 2 * moveProgress * moveProgress
                  : 1 - Math.pow(-2 * moveProgress + 2, 2) / 2;

                cameraRef.current.position.x = 0;
                cameraRef.current.position.y = startY + (endY - startY) * ease;
                cameraRef.current.position.z = startZ + (endZ - startZ) * ease;

                // LookAt: start looking at sphere center (-10), end looking AHEAD of character
                // Camera ends at Z=-8, character at Z=0, so look at Z=3 (in front of character)
                const lookY = 0 + (-5 - 0) * ease;
                const lookZ = -10 + (3 - (-10)) * ease; // -10 to +3
                cameraRef.current.lookAt(0, lookY, lookZ);
              }

              // Move character during transition
              if (characterRef.current) {
                const charEase = buildP < 0.5
                  ? 2 * buildP * buildP
                  : 1 - Math.pow(-2 * buildP + 2, 2) / 2;
                characterRef.current.position.y = -12 + (-5 - (-12)) * charEase;
                characterRef.current.position.x = 0;
                characterRef.current.position.z = 0;

                if (buildP >= 0.3 && !characterRef.current.visible) {
                  characterRef.current.visible = true;
                }
              }

              cameraAngleRef.current.horizontal = 0;
            }

            // Animate blocks
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

            scene.background.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x0a0a0a), buildP);
          }
        } else if (state === 'gallery') {
          if (textMeshRef.current) textMeshRef.current.visible = false;
          if (gridWallsRef.current) {
            gridWallsRef.current.visible = true;
            // Frames are now faded in by the marble transition code above
          }
          scene.background = new THREE.Color(0x0a0a0a);

          // Only update if not already hidden
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

      // Character movement
      if (characterRef.current && transformationStateRef.current === 'gallery') {
        const char = characterRef.current;
        const keys = keysPressed.current;
        const vel = characterVelocity.current;

        const acc = 0.008, fric = 0.92, maxSpd = 0.08;

        const fwd = new THREE.Vector3(
          Math.sin(cameraAngleRef.current.horizontal), 0,
          Math.cos(cameraAngleRef.current.horizontal)
        );
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

        if (keys.w) { vel.x += fwd.x * acc; vel.z += fwd.z * acc; }
        if (keys.s) { vel.x -= fwd.x * acc; vel.z -= fwd.z * acc; }
        if (keys.a) { vel.x += right.x * acc; vel.z += right.z * acc; }
        if (keys.d) { vel.x -= right.x * acc; vel.z -= right.z * acc; }
        if (keys.space) vel.y += acc;
        if (keys.shift) vel.y -= acc;

        vel.x *= fric; vel.y *= fric; vel.z *= fric;

        const spd = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (spd > maxSpd) { vel.x = (vel.x / spd) * maxSpd; vel.z = (vel.z / spd) * maxSpd; }
        vel.y = Math.max(-maxSpd, Math.min(maxSpd, vel.y));

        let newX = char.position.x + vel.x;
        let newY = char.position.y + vel.y;
        let newZ = char.position.z + vel.z;

        // Wall collision boundaries
        const margin = 3;
        const charRadius = 1; // Account for character orb size
        const minX = -ROOM_WIDTH / 2 + margin;
        const maxX = ROOM_WIDTH / 2 - margin;
        const minY = -14 + charRadius;
        const maxY = 14 - charRadius;
        const minZ = -ROOM_DEPTH / 2 + margin;
        const maxZ = ROOM_DEPTH / 2 - margin;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        newZ = Math.max(minZ, Math.min(maxZ, newZ));

        // OPTIMIZED: Frame collision detection - only check nearby frames
        if (gridWallsRef.current && gridWallsRef.current.userData.frameGroup) {
          const frameGroupObj = gridWallsRef.current.userData.frameGroup;
          const charRadius = 1.5;
          const checkRadius = 5; // Only check frames within this radius

          frameGroupObj.children.forEach(frame => {
            const framePos = frame.position;

            // OPTIMIZATION: Quick distance pre-check using Manhattan distance
            const roughDist = Math.abs(newX - framePos.x) +
              Math.abs(newY - framePos.y) +
              Math.abs(newZ - framePos.z);

            if (roughDist > checkRadius * 1.5) return; // Skip distant frames

            const frameRot = frame.rotation.y;

            // Calculate distance from character to frame center
            const dx = newX - framePos.x;
            const dy = newY - framePos.y;
            const dz = newZ - framePos.z;

            const frameHalfWidth = FRAME_WIDTH / 2 + 0.3;
            const frameHalfHeight = FRAME_HEIGHT / 2 + 0.3;
            const frameDepth = 0.8;

            // Check collision based on frame orientation
            const isBackOrFront = Math.abs(Math.sin(frameRot)) < 0.5;

            if (isBackOrFront) {
              // Frame facing Z direction (back/front walls)
              if (Math.abs(dx) < frameHalfWidth &&
                Math.abs(dy) < frameHalfHeight &&
                Math.abs(dz) < frameDepth + charRadius) {
                // Push character away from frame
                if (dz > 0) {
                  newZ = framePos.z + frameDepth + charRadius;
                } else {
                  newZ = framePos.z - frameDepth - charRadius;
                }
                vel.z = 0;
              }
            } else {
              // Frame facing X direction (left/right walls)
              if (Math.abs(dz) < frameHalfWidth &&
                Math.abs(dy) < frameHalfHeight &&
                Math.abs(dx) < frameDepth + charRadius) {
                // Push character away from frame
                if (dx > 0) {
                  newX = framePos.x + frameDepth + charRadius;
                } else {
                  newX = framePos.x - frameDepth - charRadius;
                }
                vel.x = 0;
              }
            }
          });
        }

        char.position.set(newX, newY, newZ);

        char.userData.orb.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
        char.userData.ring.rotation.z += deltaTime * 3;

        // OPTIMIZED: Frame proximity detection - only check frames within reasonable distance
        if (gridWallsRef.current && gridWallsRef.current.userData.frameGroup) {
          const frameGroupObj = gridWallsRef.current.userData.frameGroup;
          let closestFrame = null;
          let closestDist = Infinity;
          const interactionDist = 4; // Distance to trigger glow
          const checkDist = 15; // Pre-filter: only check frames within this distance

          // OPTIMIZATION: Only check frames every few frames, not every single frame
          const frameCheckInterval = 3; // Check every 3 frames
          const shouldCheckFrames = (Math.floor(time * 60) % frameCheckInterval) === 0;

          if (shouldCheckFrames) {
            // Pre-filter frames by rough distance before detailed check
            frameGroupObj.children.forEach(frame => {
              const framePos = frame.position;

              // Quick rough distance check (Manhattan distance is faster than Euclidean)
              const roughDist = Math.abs(char.position.x - framePos.x) +
                Math.abs(char.position.y - framePos.y) +
                Math.abs(char.position.z - framePos.z);

              // Skip frames that are definitely too far away
              if (roughDist > checkDist * 1.5) {
                // Fade out glow for distant frames
                const glowMat = frame.userData.glowMaterial;
                if (glowMat && glowMat.opacity > 0.01) {
                  glowMat.opacity *= 0.85;
                  if (glowMat.opacity < 0.01) glowMat.opacity = 0;
                }
                if (frame.scale.x !== 1) {
                  frame.scale.set(1, 1, 1);
                }
                return; // Skip this frame
              }

              // Only do expensive sqrt calculation for nearby frames
              const dx = char.position.x - framePos.x;
              const dy = char.position.y - framePos.y;
              const dz = char.position.z - framePos.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

              // Update glow based on distance
              const glowMat = frame.userData.glowMaterial;
              if (glowMat) {
                if (dist < interactionDist) {
                  // Calculate glow intensity based on distance
                  const intensity = 1 - (dist / interactionDist);
                  const targetOpacity = intensity * 0.4;
                  glowMat.opacity += (targetOpacity - glowMat.opacity) * 0.15;

                  // Subtle scale pulse when close
                  const pulse = 1 + Math.sin(time * 4) * 0.02 * intensity;
                  frame.scale.set(pulse, pulse, pulse);

                  if (dist < closestDist) {
                    closestDist = dist;
                    closestFrame = frame;
                  }
                } else if (dist < checkDist) {
                  // Fade out glow
                  glowMat.opacity *= 0.85;
                  if (glowMat.opacity < 0.01) glowMat.opacity = 0;
                  // Reset scale
                  if (frame.scale.x !== 1) {
                    frame.scale.set(1, 1, 1);
                  }
                }
              }
            });

            // Update nearby frame ref for click handling
            if (closestFrame !== nearbyFrameRef.current) {
              nearbyFrameRef.current = closestFrame;
              setNearbyFrame(closestFrame ? closestFrame.userData.frameIndex : null);
            }
          }
        }
      }

      // ============================================
      // UNIFIED CAMERA CONTROLLER
      // (Traveling camera is handled in wall building section above)
      // ============================================
      if (cameraRef.current) {
        const state = transformationStateRef.current;


        // Skip traveling - it's handled in wall building section
        if (state === 'traveling') {
          // Do nothing here - camera is controlled in wall building code
          // console.log('UNIFIED CTRL - traveling (should skip), camZ:', cameraRef.current.position.z.toFixed(2)); // DISABLED for performance
        } else if (state === 'gallery' && characterRef.current) {
          // Gallery mode: follow character
          const char = characterRef.current;
          const camDist = 8, camH = 3;

          const targetPosX = char.position.x - Math.sin(cameraAngleRef.current.horizontal) * camDist;
          const targetPosY = char.position.y + camH;
          const targetPosZ = char.position.z - Math.cos(cameraAngleRef.current.horizontal) * camDist;

          const targetLookX = char.position.x + Math.sin(cameraAngleRef.current.horizontal) * 3;
          const targetLookY = char.position.y;
          const targetLookZ = char.position.z + Math.cos(cameraAngleRef.current.horizontal) * 3;

          // Clamp camera to room bounds
          const camMargin = 2;
          const clampedPosX = Math.max(-ROOM_WIDTH / 2 + camMargin, Math.min(ROOM_WIDTH / 2 - camMargin, targetPosX));
          const clampedPosY = Math.max(-14 + camMargin, Math.min(14 - camMargin, targetPosY));
          const clampedPosZ = Math.max(-ROOM_DEPTH / 2 + camMargin, Math.min(ROOM_DEPTH / 2 - camMargin, targetPosZ));

          // Apply smoothing
          cameraRef.current.position.x += (clampedPosX - cameraRef.current.position.x) * 0.1;
          cameraRef.current.position.y += (clampedPosY - cameraRef.current.position.y) * 0.1;
          cameraRef.current.position.z += (clampedPosZ - cameraRef.current.position.z) * 0.1;

          cameraRef.current.lookAt(targetLookX, targetLookY, targetLookZ);

        } else if (state !== 'traveling') {
          // Orbit mode (sphere, dissolving, gateway, etc)
          const progress = scrollProgressRef.current / 100;
          const targetDist = 40 - progress * 37;
          const rad = Math.abs(targetDist - (-10));

          const targetPosX = rad * Math.sin(cameraAngleRef.current.horizontal);
          const targetPosY = rad * Math.sin(cameraAngleRef.current.vertical);
          const targetPosZ = rad * Math.cos(cameraAngleRef.current.horizontal) - 10;

          // Apply smoothing
          cameraRef.current.position.x += (targetPosX - cameraRef.current.position.x) * 0.1;
          cameraRef.current.position.y += (targetPosY - cameraRef.current.position.y) * 0.1;
          cameraRef.current.position.z += (targetPosZ - cameraRef.current.position.z) * 0.1;

          cameraRef.current.lookAt(0, 0, -10);
        }
      }

      // Lighting transitions
      const galleryLightProgress = transformationStateRef.current === 'gallery' ? marbleTransitionRef.current : 0;

      if (galleryLightProgress > 0) {
        // Fade out sphere-related lights during gallery transition
        const sphereLightIntensity = Math.max(0, 1 - galleryLightProgress);
        mainLight.intensity = (5 + Math.sin(time * 0.5) * 0.5) * sphereLightIntensity;
        rimLight.intensity = (4 + Math.sin(time * 0.7) * 0.5) * sphereLightIntensity;
        sphereGlow.intensity = (4 + Math.sin(time * 0.6) * 0.6) * sphereLightIntensity;
        pointLight1.intensity = 3 * sphereLightIntensity;
        pointLight2.intensity = 2.5 * sphereLightIntensity;
        pointLight3.intensity = 2 * sphereLightIntensity;

        // Fade in gallery ambient light (warmer, more even)
        ambientLight.intensity = 3.5 + galleryLightProgress * 3.0; // 3.5 -> 6.5 (much brighter)
      } else {
        mainLight.intensity = 5 + Math.sin(time * 0.5) * 0.5;
        rimLight.intensity = 4 + Math.sin(time * 0.7) * 0.5;
        sphereGlow.intensity = 4 + Math.sin(time * 0.6) * 0.6;
      }
      stars.rotation.y += deltaTime * 0.003;

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
      // CRITICAL: Cancel the animation loop first!
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      // Proper cleanup
      disposables.geometries.forEach(g => g.dispose());
      disposables.materials.forEach(m => m.dispose());
      disposables.textures.forEach(t => t.dispose());

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // PRELOAD images immediately on mount - before user even starts scrolling!
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0, isLoading: false });
  const preloadedTexturesRef = useRef({});

  useEffect(() => {
    // ============================================
    // ADD YOUR IMAGE PATHS HERE
    // ============================================

    // OPTION 1: If you have specific numbered images (e.g., artwork1.png, artwork2.png, etc.)
    // List them manually:
    const imageUrls = [
      'https://i.imgur.com/xtHecDo.jpeg',
      'https://i.imgur.com/7MNHAfO.jpeg',
      'https://i.imgur.com/HniMgIm.jpeg',

      // Add more as needed...
    ];

    // OPTION 2: If you have many numbered images, generate the array automatically:
    // Uncomment the line below and comment out the array above
    // const imageUrls = Array.from({ length: 20 }, (_, i) => `/images/artwork${i + 1}.png`);
    // Change 20 to however many images you have

    // OPTION 3: Mix of specific names:
    // const imageUrls = [
    //   '/images/sunset.png',
    //   '/images/portrait.png',
    //   '/images/landscape.png',
    // ];

    console.log('🚀 Starting image preload...');

    const validUrls = imageUrls.filter(url => url && url.trim() !== '');
    const imagesToLoad = validUrls.length;

    if (imagesToLoad === 0) {
      console.log('ℹ️ No images configured - ENTER will appear immediately');
      console.log('💡 To add your images, edit the imageUrls array in ArtGallery.jsx');
      setLoadingProgress({ loaded: 0, total: 0, isLoading: false });
      return;
    }

    console.log(`📦 Loading ${imagesToLoad} images...`);
    setLoadingProgress({ loaded: 0, total: imagesToLoad, isLoading: true });

    let loadedCount = 0;
    const loader = new THREE.TextureLoader();

    // Safety timeout: If images take too long, allow user to proceed anyway
    const loadingTimeout = setTimeout(() => {
      console.warn(`⚠️ Image loading timeout (3s) - allowing ENTER to appear. ${loadedCount}/${imagesToLoad} loaded.`);
      setLoadingProgress(prev => ({ ...prev, isLoading: false }));
    }, 3000); // 3 second timeout

    const markComplete = () => {
      loadedCount++;
      const isComplete = loadedCount >= imagesToLoad;
      setLoadingProgress({
        loaded: loadedCount,
        total: imagesToLoad,
        isLoading: !isComplete
      });

      if (isComplete) {
        clearTimeout(loadingTimeout);
        console.log(`✅ All ${imagesToLoad} images processed (${Object.keys(preloadedTexturesRef.current).length} loaded successfully)`);
      }
    };

    // Preload ALL images immediately
    validUrls.forEach((url, index) => {
      loader.load(
        url,
        (texture) => {
          // Store the loaded texture
          preloadedTexturesRef.current[index] = texture;
          console.log(`✓ Loaded: ${url}`);
          markComplete();
        },
        undefined,
        (error) => {
          console.warn(`✗ Failed to load: ${url}`, error);
          markComplete(); // Still mark as complete so we don't get stuck
        }
      );
    });

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);

  // Apply preloaded textures to frames when they're ready
  useEffect(() => {
    if (!sceneRef.current) return;

    const frameGroup = sceneRef.current.userData.frameGroup;
    if (!frameGroup || frameGroup.children.length === 0) return;

    console.log('🎨 Applying preloaded textures to frames...');

    // Helper function to create placeholder images
    function createPlaceholder(frame, index) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 910;
      const ctx = canvas.getContext('2d');

      // Create varied gradients
      const hue = (index * 37) % 360;
      const gradient = ctx.createLinearGradient(0, 0, 512, 910);
      gradient.addColorStop(0, `hsl(${hue}, 40%, 25%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 50%, 35%)`);
      gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 45%, 30%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 910);

      // Add frame number
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Art #${index + 1}`, 256, 455);

      const texture = new THREE.CanvasTexture(canvas);

      const imagePlane = frame.userData.imagePlane;
      if (imagePlane) {
        imagePlane.material.map = texture;
        imagePlane.material.color = new THREE.Color(0xffffff);
        imagePlane.material.needsUpdate = true;
      }
    }

    // Apply preloaded textures or placeholders
    frameGroup.children.forEach((frame, index) => {
      const texture = preloadedTexturesRef.current[index];
      const imagePlane = frame.userData.imagePlane;

      if (texture && imagePlane) {
        // Use preloaded texture
        imagePlane.material.map = texture;
        imagePlane.material.color = new THREE.Color(0xffffff);
        imagePlane.material.needsUpdate = true;
      } else {
        // Use placeholder
        createPlaceholder(frame, index);
      }
    });

    console.log('✅ Textures applied to frames!');
  }, []);

  useEffect(() => {
    let animationFrame;
    let targetProgress = 0;

    const handleScroll = (e) => {
      e.preventDefault();
      if (['traveling', 'gallery', 'gateway'].includes(transformationStateRef.current)) return;
      targetProgress = Math.max(0, Math.min(100, targetProgress + e.deltaY * 0.02));
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

    return () => {
      window.removeEventListener('wheel', handleScroll);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selectedFrame) {
        setSelectedFrame(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedFrame]);

  // Handle download
  const handleDownload = (resolution) => {
    if (!selectedFrame || !selectedFrame.texture) return;

    // Create canvas to render the image at different resolutions
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

    // Draw the texture image to canvas
    const image = selectedFrame.texture.image;
    if (image) {
      ctx.drawImage(image, 0, 0, res.width, res.height);

      // Trigger download
      const link = document.createElement('a');
      link.download = `artwork-${selectedFrame.index + 1}-${resolution}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

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
          {loadingProgress.isLoading ? (
            <>Loading gallery images... ({loadingProgress.loaded}/{loadingProgress.total})<br />Click and drag to orbit • Scroll to approach</>
          ) : (
            <>Click and drag to orbit • Scroll to approach</>
          )}
        </div>
      )}

      {currentState === 'gallery' && !selectedFrame && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Arial, sans-serif',
          textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: 5
        }}>
          WASD: Move • Space: Up • Shift: Down • Drag: Rotate{nearbyFrame !== null && ' • Click to view artwork'}
        </div>
      )}

      {/* Interaction prompt when near frame */}
      {currentState === 'gallery' && nearbyFrame !== null && !selectedFrame && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.9)', fontSize: 18, fontFamily: 'Arial, sans-serif',
          textAlign: 'center', pointerEvents: 'none',
          textShadow: '0 0 10px rgba(68, 136, 255, 0.8), 0 0 20px rgba(68, 136, 255, 0.5)'
        }}>
          Click to view
        </div>
      )}

      {/* Image Modal */}
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
          {/* Close button */}
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

          {/* Image display */}
          <div style={{
            maxWidth: '80vw', maxHeight: '70vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 30
          }}>
            {selectedFrame.texture && selectedFrame.texture.image ? (
              <img
                src={selectedFrame.texture.image.src || selectedFrame.texture.image.toDataURL?.() || ''}
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

          {/* Artwork info */}
          <div style={{
            color: 'white', fontSize: 20, marginBottom: 20,
            fontFamily: 'Arial, sans-serif'
          }}>
            Artwork #{selectedFrame.index + 1}
          </div>

          {/* Download buttons */}
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

          {/* ESC hint */}
          <div style={{
            position: 'absolute', bottom: 20,
            color: 'rgba(255,255,255,0.5)', fontSize: 12,
            fontFamily: 'Arial, sans-serif'
          }}>
            Press ESC or click outside to close
          </div>
        </div>
      )}

      {/* Loading Screen - Show during initial load */}
      {loadingProgress.isLoading && (currentState === 'sphere' || currentState === 'gateway') && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
          zIndex: 100
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.9)', fontSize: 24, fontFamily: 'Arial, sans-serif',
            marginBottom: 20,
            textShadow: '0 0 10px rgba(68, 136, 255, 0.8), 0 0 20px rgba(68, 136, 255, 0.5)'
          }}>
            Loading Gallery...
          </div>
          <div style={{
            width: 300, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2,
            overflow: 'hidden', margin: '0 auto'
          }}>
            <div style={{
              width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4488ff, #88aaff)',
              transition: 'width 0.3s ease',
              boxShadow: '0 0 10px rgba(68, 136, 255, 0.8)'
            }} />
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Arial, sans-serif',
            marginTop: 15
          }}>
            {loadingProgress.loaded} / {loadingProgress.total} images
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 20, right: 20, color: 'rgba(255,255,255,0.8)',
        fontSize: 14, fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)',
        padding: '10px 15px', borderRadius: 5
      }}>
        {Math.round(scrollProgress)}% • {currentState}
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
