import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

class AerodynamicTraces {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.paths = null;
        this.maxVelocity = 20.0;
    }

    clear() {
        this.group.clear();
        if(this.particleCloud) {
            this.particleCloud.geometry.dispose();
            this.particleCloud.material.dispose();
            this.particleCloud = null;
        }
    }

    updateBackendPaths(paths, v_wind) {
        this.clear();
        if(!paths || paths.length === 0) return;
        this.paths = paths; 
        this.maxVelocity = v_wind;
        
        // Count total nodes to render
        const particlesPerPath = 30; 
        const count = paths.length * particlesPerPath;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const pathIndices = new Float32Array(count);
        const tParams = new Float32Array(count);
        
        let pidx = 0;
        for(let i=0; i<paths.length; i++) {
            for(let j=0; j<particlesPerPath; j++) {
                pathIndices[pidx] = i;
                tParams[pidx] = Math.random(); 
                pidx++;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('pathIndex', new THREE.BufferAttribute(pathIndices, 1));
        geometry.setAttribute('tParam', new THREE.BufferAttribute(tParams, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.15,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });
        
        this.particleCloud = new THREE.Points(geometry, material);
        this.group.add(this.particleCloud);
    }
    
    updateParticles(deltaTime, loopDuration) {
        if(!this.particleCloud || !this.paths) return;
        const positions = this.particleCloud.geometry.attributes.position.array;
        const colors = this.particleCloud.geometry.attributes.color.array;
        const tParams = this.particleCloud.geometry.attributes.tParam.array;
        const pIndices = this.particleCloud.geometry.attributes.pathIndex.array;
        
        const tStep = deltaTime / loopDuration;
        
        for(let i=0; i<tParams.length; i++) {
            let t = tParams[i] + tStep;
            if(t > 1.0) t -= 1.0;
            tParams[i] = t;
            
            const pathIdx = pIndices[i];
            const pathData = this.paths[pathIdx];
            const coords = pathData.coords;
            const vels = pathData.vels;
            const len = coords.length;
            
            const exactIndex = t * (len - 1);
            const indexFloor = Math.floor(exactIndex);
            const indexCeil = Math.min(len - 1, indexFloor + 1);
            const frac = exactIndex - indexFloor;
            
            const p1 = coords[indexFloor];
            const p2 = coords[indexCeil];
            
            positions[i*3] = p1[0] + (p2[0]-p1[0])*frac;
            positions[i*3+1] = p1[1] + (p2[1]-p1[1])*frac;
            positions[i*3+2] = p1[2] + (p2[2]-p1[2])*frac;
            
            if (pathData.type === 'vortex') {
                colors[i*3] = 0.6;
                colors[i*3+1] = 0.6;
                colors[i*3+2] = 0.6;
            } else {
                const v1 = vels[indexFloor];
                const v2 = vels[indexCeil];
                const v = v1 + (v2-v1)*frac;
                const speedNorm = Math.min(1.0, Math.max(0.0, v / this.maxVelocity));
                
                // Slow = Red (1,0,0), Fast = Cyan/Blue (0, 0.9, 1)
                colors[i*3]   = 1.0 - speedNorm*0.8; // red drops
                colors[i*3+1] = speedNorm * 0.9;
                colors[i*3+2] = speedNorm * 1.0;
            }
        }
        
        this.particleCloud.geometry.attributes.position.needsUpdate = true;
        this.particleCloud.geometry.attributes.color.needsUpdate = true;
        this.particleCloud.geometry.attributes.tParam.needsUpdate = true;
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
        
        // Transient Engine controls
        this.clock = new THREE.Clock();
        this.v_wind = 20.0;
        this.yaw = 0.0;
        this.resolution = 20;
        this.loopDuration = 4.0;
        this.carGroup = new THREE.Group();
        this.scene.add(this.carGroup);

        this.currentModelId = 'default';
        this.probeLocked = false;
        
        this.init();
        this.animate();
        this.setupEventListeners();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(-15, 8, 15);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true; 
        this.controls.minDistance = 2;
        this.controls.maxDistance = 100;

        // Studio Lighting Setup
        this.scene.fog = new THREE.FogExp2(0x0c0e17, 0.02);
        
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0c0e17, 0.6);
        this.scene.add(hemiLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
        mainLight.position.set(10, 20, 15);
        this.scene.add(mainLight);

        const rimLight = new THREE.DirectionalLight(0x00f2ff, 1.5);
        rimLight.position.set(-15, 5, -15);
        this.scene.add(rimLight);

        // Env
        const grid = new THREE.GridHelper(60, 60, 0x222222, 0x111111);
        grid.position.y = -3;
        this.scene.add(grid);

        this.createCar();
        this.createProbeMarker();
        this.flowParticles = new AerodynamicTraces(this.scene);
        
        this.flowParticles.updateStreamlines(this.generateMockPaths());

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        
        document.getElementById('btn-reset-view').addEventListener('click', () => this.resetCamera());
        
        const velocitySlider = document.getElementById('slider-velocity');
        const velocityVal = document.getElementById('velocity-val');
        if (velocitySlider) {
            velocitySlider.addEventListener('input', (e) => {
                this.v_wind = parseFloat(e.target.value);
                velocityVal.innerText = `${this.v_wind.toFixed(1)} M/S`;
            });
        }
        
        const yawSlider = document.getElementById('slider-yaw');
        const yawVal = document.getElementById('yaw-val');
        if (yawSlider) {
            yawSlider.addEventListener('input', (e) => {
                this.yaw = parseFloat(e.target.value);
                yawVal.innerText = `${this.yaw}&deg;`;
                if(this.carGroup) {
                    // Update visual orientation of car instantly mapping yaw
                    this.carGroup.rotation.y = -THREE.MathUtils.degToRad(this.yaw);
                }
            });
        }
        
        const resSlider = document.getElementById('slider-resolution');
        const resVal = document.getElementById('res-val');
        if (resSlider) {
            resSlider.addEventListener('input', (e) => {
                this.resolution = parseInt(e.target.value);
                resVal.innerText = this.resolution;
            });
        }
        
        const loopSlider = document.getElementById('slider-loop');
        const loopVal = document.getElementById('loop-val');
        if (loopSlider) {
            loopSlider.addEventListener('input', (e) => {
                this.loopDuration = parseFloat(e.target.value);
                loopVal.innerText = `${this.loopDuration.toFixed(1)}s`;
            });
        }

        document.getElementById('btn-track-analysis').addEventListener('click', () => this.showTrackAnalysis());
        
        document.getElementById('check-streamlines')?.addEventListener('change', (e) => {
            if(this.flowParticles) this.flowParticles.group.visible = e.target.checked;
        });
        
        document.getElementById('check-heatmap')?.addEventListener('change', (e) => {
            if(this.carMaterial) {
                if(e.target.checked && this.simData) {
                   this.updateHeatmap(this.simData);
                } else {
                   this.carMaterial.color.setHex(0x1a1a1a);
                }
            }
        });

        document.getElementById('check-vortex')?.addEventListener('change', (e) => {
            if(this.flowParticles) this.flowParticles.vortexGroup.visible = e.target.checked;
        });

        // Navigation system
        document.getElementById('nav-models').addEventListener('click', () => this.switchView('models'));
        document.getElementById('nav-simulator').addEventListener('click', () => this.switchView('simulator'));
        document.getElementById('nav-sensors').addEventListener('click', () => this.switchView('sensors'));
    }

    switchView(viewName) {
        const viewModels = document.getElementById('view-models');
        const viewSimulator = document.getElementById('view-simulator');
        const viewSensors = document.getElementById('view-sensors');
        
        const navModels = document.getElementById('nav-models');
        const navSimulator = document.getElementById('nav-simulator');
        const navSensors = document.getElementById('nav-sensors');

        // Reset all hiding
        viewModels.classList.add('hidden');
        viewSimulator.classList.add('hidden');
        viewSensors.classList.add('hidden');

        // Reset all nav styling
        [navModels, navSimulator, navSensors].forEach(nav => {
            nav.classList.remove('border-b-2', 'border-[#81ecff]', 'text-[#81ecff]');
            nav.classList.add('text-slate-400');
        });

        if (viewName === 'models') {
            viewModels.classList.remove('hidden');
            navModels.classList.add('border-b-2', 'border-[#81ecff]', 'text-[#81ecff]');
            navModels.classList.remove('text-slate-400');
        } else if (viewName === 'sensors') {
            viewSensors.classList.remove('hidden');
            navSensors.classList.add('border-b-2', 'border-[#81ecff]', 'text-[#81ecff]');
            navSensors.classList.remove('text-slate-400');
        } else {
            viewSimulator.classList.remove('hidden');
            navSimulator.classList.add('border-b-2', 'border-[#81ecff]', 'text-[#81ecff]');
            navSimulator.classList.remove('text-slate-400');
            setTimeout(() => this.onWindowResize(), 100);
        }
    }

    async showTrackAnalysis() {
        // Elements are always visible in the new HUD, we just need to populate them.

        // We use current metrics if available, or default to current model simulation
        const cd = 0.35 * (1 - (this.simData ? this.simData.efficiency / 10 : 0));
        const cl = 0.1 * (1 + (this.simData ? this.simData.downforce / 500 : 0));

        try {
            const response = await fetch(`${this.apiUrl}/track/analysis?model_id=${this.currentModelId}&cd=${cd}&cl=${cl}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                this.updatePerfUI(data.metrics);
                this.drawTrackMap(data.telemetry);
            }
        } catch (err) {
            console.error("Track analysis failed:", err);
        }
    }

    updatePerfUI(metrics) {
        const delta = metrics.delta_time;
        const color = delta < 0 ? '#00ffaa' : '#ff4444';
        const sign = delta < 0 ? '' : '+';
        
        document.getElementById('perf-lap-delta').innerText = `${sign}${delta.toFixed(2)}s`;
        document.getElementById('perf-lap-delta').style.color = color;
        document.getElementById('perf-speed-gain').innerText = `${metrics.top_speed_gain.toFixed(1)} km/h`;
    }

    drawTrackMap(telemetry) {
        const canvas = document.getElementById('track-map');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Normalize coordinates
        const lats = telemetry.map(t => t.lat);
        const lons = telemetry.map(t => t.lon);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);

        const pad = 20;
        const w = canvas.width - 2*pad;
        const h = canvas.height - 2*pad;

        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        telemetry.forEach((t, i) => {
            const x = pad + ((t.lon - minLon) / (maxLon - minLon)) * w;
            const y = pad + (1 - (t.lat - minLat) / (maxLat - minLat)) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Pulsing marker for current position (simplified as static start for now)
        ctx.fillStyle = '#ff00ea';
        const startX = pad + ((telemetry[0].lon - minLon) / (maxLon - minLon)) * w;
        const startY = pad + (1 - (telemetry[0].lat - minLat) / (maxLat - minLat)) * h;
        ctx.beginPath();
        ctx.arc(startX, startY, 4, 0, Math.PI*2);
        ctx.fill();
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
            const baseY = (Math.random() - 0.5) * 6;
            const baseZ = (Math.random() - 0.5) * 6;
            for (let j = 0; j < 30; j++) {
                const x = -15 + j * 1;
                // Distance to a mock bounding box around (0,0,0)
                const dist = Math.sqrt(x*x + baseY*baseY + baseZ*baseZ);
                let defY = 0, defZ = 0;
                if (dist < 4) {
                    // push air away from the center obstacle
                    const push = Math.pow(1 - dist/4, 2) * 3;
                    defY = (baseY >= 0 ? 1 : -1) * push;
                    defZ = (baseZ >= 0 ? 1 : -1) * push;
                }
                // Also give a slight upward lift effect since car.position.y is -1.5
                // The center of the car is around y=0
                p.push([x, baseY + defY, baseZ + defZ]);
            }
            paths.push(p);
        }
        return paths;
    }

    createCar() {
        if (this.car) this.carGroup.remove(this.car);
        
        this.carMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666677, // Bright sleek metallic grey
            metalness: 0.8,
            roughness: 0.3
        });
        
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1); // temporal ghost
        this.car = new THREE.Mesh(geometry, this.carMaterial);
        this.car.position.y = -1.5;
        this.car.name = "Automobile";
        
        this.scene.add(this.carGroup);
        this.carGroup.add(this.car);
        
        const loader = new OBJLoader();
        loader.load('/mustang.obj', (object) => {
            let gm = null;
            object.traverse(child => {
                if (child.isMesh && !gm) gm = child.geometry;
            });
            if (gm) {
                gm.rotateY(-Math.PI / 2); // default frontal rotation
                this.updateModel(gm);
            }
        });
    }

    setupEventListeners() {
        document.getElementById('btn-run').addEventListener('click', () => this.runSimulation());
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        
        document.querySelectorAll('.btn-load-preset').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePresetClick(e.target.dataset.id));
        });

        const dropZone = document.getElementById('drop-zone');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-primary'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-primary'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
            this.handleFileUpload({ target: { files: e.dataTransfer.files } });
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        document.getElementById('footer-status').innerText = 'SYSTEM STATUS: UPLOADING';

        try {
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                this.currentModelId = data.id;
                this.loadModelLocally(file); 
                document.getElementById('footer-status').innerText = 'SYSTEM STATUS: IDLE';
                this.switchView('simulator');
            }
        } catch (err) {
            console.error("Upload failed:", err);
            document.getElementById('footer-status').innerText = 'SYSTEM STATUS: ERROR';
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

    handlePresetClick(modelId) {
        this.currentModelId = modelId;
        if (this.currentModelId === 'ahmed') {
            const geometry = new THREE.BoxGeometry(4, 1.2, 1.2); 
            this.updateModel(geometry);
        } else if (this.currentModelId === 'drivaer') {
            const geometry = new THREE.BoxGeometry(6, 1.5, 2.0);
            this.updateModel(geometry);
        }
        this.switchView('simulator');
        this.runSimulation();
    }

    updateModel(geometry) {
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        this.geomCenter = center.clone(); // save for streamline translation
        geometry.translate(-center.x, -center.y, -center.z);
        
        this.car.geometry.dispose();
        this.car.geometry = geometry;
        this.car.position.y = -1.5;
        this.probeLocked = false;
        this.probeMarker.visible = false;
        
        // Backend now native computes vortex paths.
    }

    async runSimulation() {
        const loading = document.getElementById('loading');
        const indicator = document.getElementById('sim-indicator');
        loading.classList.remove('opacity-0', 'pointer-events-none');
        indicator.classList.remove('hidden');

        try {
            const response = await fetch(`${this.apiUrl}/simulate?model_id=${this.currentModelId}&v_wind=${this.v_wind}&yaw=${this.yaw}&resolution=${this.resolution}`, { method: 'POST' });
            const data = await response.json();
            
            if (data.status === 'success') {
                this.simData = data.metrics;
                this.updateUI(data.metrics);
                this.updateSensorsView(data.metrics);
                this.updateHeatmap(data.metrics);
                if (data.metrics.streamlines) {
                    const shiftX = this.geomCenter ? -this.geomCenter.x : 0;
                    const shiftY = this.geomCenter ? -this.geomCenter.y : 0;
                    const shiftZ = this.geomCenter ? -this.geomCenter.z : 0;
                    
                    const offsetStreamlines = data.metrics.streamlines.map(pathData => {
                        return {
                           type: pathData.type,
                           vels: pathData.vels,
                           coords: pathData.coords.map(pt => [pt[0] + shiftX, pt[1] + shiftY, pt[2] + shiftZ])
                        };
                    });
                    this.flowParticles.updateBackendPaths(offsetStreamlines, this.v_wind);
                }
                document.getElementById('footer-status').innerText = 'SYSTEM STATUS: DATA RENDERED';
            }
        } catch (err) {
            console.error("Simulation failed:", err);
            document.getElementById('footer-status').innerText = 'SYSTEM STATUS: SIMULATION ERROR';
        } finally {
            setTimeout(() => {
                loading.classList.add('opacity-0', 'pointer-events-none');
                indicator.classList.add('hidden');
            }, 800);
        }
    }

    updateSensorsView(metrics) {
        document.getElementById('sensor-val-downforce').innerText = metrics.downforce.toFixed(1);
        // Gen mock table data based on metrics
        const tbody = document.getElementById('sensor-table-body');
        tbody.innerHTML = '';
        
        for(let i=0; i<15; i++) {
            const id = `S-${(40+i).toString().padStart(3, '0')}-${i%2===0?'A':'B'}`;
            const x = (120 + Math.random()*30).toFixed(3);
            const y = (10 + Math.random()*5).toFixed(3);
            const z = (Math.random()*2 - 1).toFixed(3);
            const p = (101.3 + Math.random()*15 * (Math.random()>0.5?1:-1)).toFixed(2);
            const isWarn = parseFloat(p) > 115 || parseFloat(p) < 90;
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-white/5 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-3 text-primary">${id}</td>
                <td class="px-6 py-3 text-on-surface-variant">${x}</td>
                <td class="px-6 py-3 text-on-surface-variant">${y}</td>
                <td class="px-6 py-3 text-on-surface-variant">${z}</td>
                <td class="px-6 py-3">
                    <span class="px-1.5 py-0.5 ${isWarn ? 'bg-error/10 text-error border-error/20' : 'bg-secondary/10 text-secondary border-secondary/20'} border">
                        ${isWarn ? 'WARN' : 'ACTIVE'}
                    </span>
                </td>
                <td class="px-6 py-3 text-right font-bold text-on-surface">${p}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    updateUI(metrics) {
        document.getElementById('val-downforce').innerText = `${metrics.downforce.toFixed(2)} N`;
        document.getElementById('val-drag').innerText = `${metrics.drag.toFixed(2)} N`;
        document.getElementById('val-eff').innerText = `Eff: ${metrics.efficiency.toFixed(2)}`;
        
        // Update bar widths
        const dfPct = Math.min(100, Math.max(0, (metrics.downforce / 500) * 100));
        const dgPct = Math.min(100, Math.max(0, (metrics.drag / 200) * 100));
        document.getElementById('bar-downforce').style.width = `${dfPct}%`;
        document.getElementById('bar-drag').style.width = `${dgPct}%`;
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
        const hud = document.getElementById('probe-hud');

        if (intersects.length > 0) {
            hud.classList.remove('opacity-0');
            const point = intersects[0].point;
            const distFromFront = point.x - (-3);
            const p = Math.max(-250, 180 * (1 - distFromFront/6) + (Math.sin(performance.now()*0.01) * 3));
            const u = this.v_wind * (0.4 + 0.6 * (distFromFront/6)) ;
            const cp = p / (0.5 * 1.225 * this.v_wind**2);

            document.getElementById('probe-p').innerHTML = `${p.toFixed(2)} <span class="text-sm">Pa</span>`;
            document.getElementById('probe-u').innerHTML = `${u.toFixed(2)} <span class="text-sm">m/s</span>`;
            document.getElementById('probe-cp').innerText = `Cp: ${cp.toFixed(2)}`;
            
            // Also sync to Sensores macro gauge
            document.getElementById('sensor-val-pressure').innerText = p.toFixed(1);
            
            if (this.probeLocked) {
                document.getElementById('probe-title').innerText = "PROBE DATA (LOCKED)";
            } else {
                document.getElementById('probe-title').innerText = "PROBE DATA";
            }
        } else {
            if (!this.probeLocked) {
                hud.classList.add('opacity-0');
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

        if (this.probeMarker && this.probeMarker.visible) {
            this.probeGlow.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.2);
        }
        
        // Update true Transient Backend Frames
        const dt = this.clock.getDelta();
        if (this.flowParticles && this.flowParticles.group.visible) {
            this.flowParticles.updateParticles(dt, this.loopDuration);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new WindTunnelApp();


