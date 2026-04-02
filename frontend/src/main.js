import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

class FlowParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.numParticlesPerStream = 15;
        this.particles = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.currentStreamlineData = null;
        
        this.material = new THREE.PointsMaterial({
            color: 0x00f2ff,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    setDensity(value) {
        this.numParticlesPerStream = value;
        if (this.currentStreamlineData) {
            this.updateStreamlines(this.currentStreamlineData);
        }
    }

    updateStreamlines(streamlineData) {
        this.currentStreamlineData = streamlineData;
        // Clear old particles
        this.group.clear();
        this.particles = [];

        streamlineData.forEach((path) => {
            const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])));
            
            for (let i = 0; i < this.numParticlesPerStream; i++) {
                const geometry = new THREE.BufferGeometry();
                const position = new Float32Array([0, 0, 0]);
                geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
                
                const particle = new THREE.Points(geometry, this.material);
                const offset = Math.random();
                
                this.particles.push({
                    mesh: particle,
                    curve: curve,
                    t: offset,
                    speed: 0.005 + Math.random() * 0.005
                });
                
                this.group.add(particle);
            }
        });
    }

    update(time) {
        this.particles.forEach(p => {
            p.t += p.speed;
            if (p.t > 1) p.t = 0;
            
            const pos = p.curve.getPointAt(p.t);
            p.mesh.position.copy(pos);
        });
    }
}

class WindTunnelApp {
    constructor() {
        this.container = document.getElementById('three-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.simData = null;
        this.apiUrl = 'http://localhost:8000';
        this.v_wind = 20.0;
        this.currentModelId = 'default';
        this.probeLocked = false;
        
        this.init();
        this.animate();
        this.setupEventListeners();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(-15, 8, 15);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true; 
        this.controls.minDistance = 2;
        this.controls.maxDistance = 100;

        // Lighting
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(10, 20, 10);
        this.scene.add(mainLight);

        // Env
        const grid = new THREE.GridHelper(60, 60, 0x222222, 0x111111);
        grid.position.y = -3;
        this.scene.add(grid);

        this.createCar();
        this.createProbeMarker();
        this.flowParticles = new FlowParticleSystem(this.scene);
        
        // Initial mock streamlines until first simulation
        this.flowParticles.updateStreamlines(this.generateMockPaths());

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        
        document.getElementById('btn-reset-view').addEventListener('click', () => this.resetCamera());
        document.getElementById('slider-particles').addEventListener('input', (e) => {
            this.flowParticles.setDensity(parseInt(e.target.value));
        });
    }

    createProbeMarker() {
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ea, transparent: true, opacity: 0.8 });
        this.probeMarker = new THREE.Mesh(geometry, material);
        this.probeMarker.visible = false;
        this.scene.add(this.probeMarker);
        
        // Add a glow/halo
        const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff00ea, transparent: true, opacity: 0.3 });
        this.probeGlow = new THREE.Mesh(glowGeo, glowMat);
        this.probeMarker.add(this.probeGlow);
    }

    resetCamera() {
        this.camera.position.set(-15, 8, 15);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    generateMockPaths() {
        const paths = [];
        for (let i = 0; i < 30; i++) {
            const p = [];
            const y = (Math.random() - 0.5) * 10;
            const z = (Math.random() - 0.5) * 10;
            for (let j = 0; j < 10; j++) {
                p.push([-20 + j * 4, y, z]);
            }
            paths.push(p);
        }
        return paths;
    }

    createCar() {
        if (this.car) this.scene.remove(this.car);
        
        const geometry = new THREE.BoxGeometry(7, 1.8, 2.8);
        this.carMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            metalness: 0.9,
            roughness: 0.1
        });
        this.car = new THREE.Mesh(geometry, this.carMaterial);
        this.car.position.y = -1.5;
        this.car.name = "Automobile";
        this.scene.add(this.car);
    }

    setupEventListeners() {
        document.getElementById('btn-run').addEventListener('click', () => this.runSimulation());
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('select-preset').addEventListener('change', (e) => this.handlePresetChange(e));
        
        const dropZone = document.getElementById('drop-zone');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = "#00f2ff"; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ""; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = "";
            this.handleFileUpload({ target: { files: e.dataTransfer.files } });
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const loading = document.getElementById('loading');
        loading.classList.add('active');

        try {
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                this.currentModelId = data.id;
                this.loadModelLocally(file); 
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            loading.classList.remove('active');
        }
    }

    loadModelLocally(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const contents = e.target.result;
            if (file.name.endsWith('.stl')) {
                const geometry = new STLLoader().parse(contents);
                this.updateModel(geometry);
            } else if (file.name.endsWith('.obj')) {
                const object = new OBJLoader().parse(contents);
                object.traverse(child => {
                    if (child.isMesh) this.updateModel(child.geometry);
                });
            }
        };
        if (file.name.endsWith('.stl')) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    }

    handlePresetChange(event) {
        this.currentModelId = event.target.value;
        if (this.currentModelId === 'ahmed') {
            const geometry = new THREE.BoxGeometry(4, 1.2, 1.2); 
            this.updateModel(geometry);
        } else if (this.currentModelId === 'drivaer') {
            const geometry = new THREE.BoxGeometry(6, 1.5, 2.0);
            this.updateModel(geometry);
        }
        this.runSimulation();
    }

    updateModel(geometry) {
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        
        this.car.geometry.dispose();
        this.car.geometry = geometry;
        this.car.position.y = -1.5;
        this.probeLocked = false;
        this.probeMarker.visible = false;
    }

    async runSimulation() {
        const loading = document.getElementById('loading');
        loading.classList.add('active');

        try {
            const response = await fetch(`${this.apiUrl}/simulate?model_id=${this.currentModelId}`, { method: 'POST' });
            const data = await response.json();
            
            if (data.status === 'success') {
                this.simData = data.metrics;
                this.updateUI(data.metrics);
                this.updateHeatmap(data.metrics);
                if (data.metrics.streamlines) {
                    this.flowParticles.updateStreamlines(data.metrics.streamlines);
                }
            }
        } catch (err) {
            console.error("Simulation failed:", err);
        } finally {
            setTimeout(() => loading.classList.remove('active'), 800);
        }
    }

    updateUI(metrics) {
        document.getElementById('val-downforce').innerHTML = `${metrics.downforce.toFixed(2)} <small>N</small>`;
        document.getElementById('val-drag').innerHTML = `${metrics.drag.toFixed(2)} <small>N</small>`;
        document.getElementById('val-eff').innerText = metrics.efficiency.toFixed(2);
    }

    onMouseMove(event) {
        if (this.probeLocked) return;
        this.updateMouseCoords(event);
        this.updateProbe();
    }

    onMouseClick(event) {
        this.updateMouseCoords(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.car);

        if (intersects.length > 0) {
            this.probeLocked = !this.probeLocked;
            this.probeMarker.visible = true;
            this.probeMarker.position.copy(intersects[0].point);
            this.updateProbe();
        } else {
            this.probeLocked = false;
            this.probeMarker.visible = false;
        }
    }

    updateMouseCoords(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    updateProbe() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.car);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const distFromFront = point.x - (-3);
            const p = Math.max(-250, 180 * (1 - distFromFront/6) + (Math.sin(performance.now()*0.01) * 3));
            const u = this.v_wind * (0.4 + 0.6 * (distFromFront/6)) ;
            const cp = p / (0.5 * 1.225 * this.v_wind**2);

            document.getElementById('probe-p').innerText = `P: ${p.toFixed(2)} Pa`;
            document.getElementById('probe-u').innerText = `U: ${u.toFixed(2)} m/s`;
            document.getElementById('probe-cp').innerText = `Cp: ${cp.toFixed(2)}`;
            
            if (this.probeLocked) {
                document.querySelector('.probe-overlay h4').innerText = "PROBE DATA (LOCKED)";
            } else {
                document.querySelector('.probe-overlay h4').innerText = "PROBE DATA";
            }
        }
    }

    updateHeatmap(metrics) {
        const intensity = Math.min(1, metrics.downforce / 300);
        this.carMaterial.color.setHSL(0.6 - (intensity * 0.6), 0.9, 0.5);
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.flowParticles) {
            this.flowParticles.update();
        }

        if (this.probeMarker && this.probeMarker.visible) {
            this.probeGlow.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.2);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new WindTunnelApp();


