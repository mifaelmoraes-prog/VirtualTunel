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
        this.carCenter = new THREE.Vector3(0, -1.5, 0);
    }

    clear() {
        this.group.clear();
        if(this.particleCloud) {
            this.particleCloud.geometry.dispose();
            this.particleCloud.material.dispose();
            this.particleCloud = null;
        }
        if(this.smokeTrails) {
            this.smokeTrails.forEach(trail => {
                trail.geometry.dispose();
                trail.material.dispose();
            });
            this.smokeTrails = [];
        }
    }

    setCarCenter(center) {
        this.carCenter.copy(center);
    }

    // Adapter for simple coordinate arrays (mock/initial streamlines)
    updateStreamlines(coordPaths) {
        const paths = coordPaths.map(coords => ({
            type: 'streamline',
            coords: coords,
            vels: coords.map((_, i) => this.maxVelocity * (0.5 + 0.5 * (i / coords.length)))
        }));
        this.updateBackendPaths(paths, this.maxVelocity);
    }

    setCarFromObject(carObject) {
        if(carObject) {
            const box = new THREE.Box3().setFromObject(carObject);
            const center = new THREE.Vector3();
            box.getCenter(center);
            this.setCarCenter(center);
        }
    }

    updateBackendPaths(paths, v_wind) {
        this.clear();
        if(!paths || paths.length === 0) return;
        this.paths = paths; 
        this.maxVelocity = v_wind;
        
        const particlesPerPath = 30; 
        const count = paths.length * particlesPerPath;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const pathIndices = new Float32Array(count);
        const tParams = new Float32Array(count);
        const alphaParams = new Float32Array(count);
        
        let pidx = 0;
        for(let i=0; i<paths.length; i++) {
            for(let j=0; j<particlesPerPath; j++) {
                pathIndices[pidx] = i;
                tParams[pidx] = Math.random(); 
                alphaParams[pidx] = 1.0;
                pidx++;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('pathIndex', new THREE.BufferAttribute(pathIndices, 1));
        geometry.setAttribute('tParam', new THREE.BufferAttribute(tParams, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphaParams, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.18,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });
        
        this.particleCloud = new THREE.Points(geometry, material);
        this.group.add(this.particleCloud);
        
        this.createSmokeTrails(paths);
    }
    
    createSmokeTrails(paths) {
        this.smokeTrails = [];
        
        const numTrails = Math.min(25, paths.length);
        const trailIndices = [];
        for(let i = 0; i < paths.length; i += Math.ceil(paths.length / numTrails)) {
            trailIndices.push(i);
        }
        
        for(const pathIdx of trailIndices) {
            const pathData = paths[pathIdx];
            if(!pathData || !pathData.coords || pathData.coords.length < 2) continue;
            
            const trailGeometry = new THREE.BufferGeometry();
            const numPoints = 60;
            const positions = new Float32Array(numPoints * 3);
            const opacities = new Float32Array(numPoints);
            
            for(let i = 0; i < numPoints; i++) {
                const t = i / (numPoints - 1);
                const coordIdx = Math.floor(t * (pathData.coords.length - 1));
                const nextIdx = Math.min(coordIdx + 1, pathData.coords.length - 1);
                const frac = (t * (pathData.coords.length - 1)) - coordIdx;
                
                const c1 = pathData.coords[coordIdx];
                const c2 = pathData.coords[nextIdx];
                
                positions[i*3] = c1[0] + (c2[0] - c1[0]) * frac;
                positions[i*3+1] = c1[1] + (c2[1] - c1[1]) * frac;
                positions[i*3+2] = c1[2] + (c2[2] - c1[2]) * frac;
                
                const dx = positions[i*3] - this.carCenter.x;
                const isDownstream = dx > 0;
                const distFromCenter = Math.abs(dx) / 5;
                
                if(isDownstream) {
                    const spreadFactor = Math.min(1, distFromCenter * 0.5);
                    const jitter = (Math.random() - 0.5) * 0.15 * spreadFactor;
                    positions[i*3+1] += jitter;
                    positions[i*3+2] += jitter;
                    opacities[i] = 0.4 * (1 - distFromCenter * 0.3);
                } else {
                    opacities[i] = 0.5;
                }
            }
            
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            trailGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
            
            const trailMaterial = new THREE.LineBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.25,
                blending: THREE.AdditiveBlending,
                linewidth: 1
            });
            
            const trail = new THREE.Line(trailGeometry, trailMaterial);
            this.smokeTrails.push(trail);
            this.group.add(trail);
        }
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
            
            const worldX = positions[i*3];
            const dx = worldX - this.carCenter.x;
            const isDownstream = dx > 0;
            const distFromCar = Math.sqrt(
                Math.pow(positions[i*3+1] - this.carCenter.y, 2) + 
                Math.pow(positions[i*3+2] - this.carCenter.z, 2)
            );
            
            let smokeOpacity = 0.7;
            let r, g, b;
            
            if (!isDownstream) {
                const upstreamPos = Math.max(0, 1 - Math.abs(dx) / 10);
                smokeOpacity = 0.2 + upstreamPos * 0.3;
                
                r = 0.7;
                g = 0.85;
                b = 1.0;
            } else {
                const wakeIntensity = Math.min(1, distFromCar / 3);
                smokeOpacity = 0.5 - wakeIntensity * 0.3;
                
                if (pathData.type === 'vortex') {
                    r = 0.6;
                    g = 0.6;
                    b = 0.65;
                } else {
                    const v1 = vels[indexFloor];
                    const v2 = vels[indexCeil];
                    const v = v1 + (v2-v1)*frac;
                    const speedNorm = Math.min(1.0, Math.max(0.0, v / this.maxVelocity));
                    
                    r = 1.0 - speedNorm * 0.8;
                    g = speedNorm * 0.9;
                    b = speedNorm * 1.0;
                }
                
                const spreadNoise = Math.sin(t * 50 + i) * 0.05;
                positions[i*3+1] += spreadNoise * (1 + wakeIntensity);
                positions[i*3+2] += Math.cos(t * 40 + i) * 0.05 * (1 + wakeIntensity);
            }
            
            colors[i*3] = r * smokeOpacity;
            colors[i*3+1] = g * smokeOpacity;
            colors[i*3+2] = b * smokeOpacity;
        }
        
        this.particleCloud.geometry.attributes.position.needsUpdate = true;
        this.particleCloud.geometry.attributes.color.needsUpdate = true;
        this.particleCloud.geometry.attributes.tParam.needsUpdate = true;
        
        this.updateSmokeTrails(deltaTime);
    }
    
    updateSmokeTrails(deltaTime) {
        if(!this.smokeTrails || this.smokeTrails.length === 0) return;
        
        const time = performance.now() * 0.001;
        
        for(const trail of this.smokeTrails) {
            const positions = trail.geometry.attributes.position.array;
            const opacities = trail.geometry.attributes.opacity.array;
            
            for(let i = 0; i < positions.length / 3; i++) {
                const x = positions[i*3];
                const dx = x - this.carCenter.x;
                
                if(dx > 0) {
                    const distFromCenter = Math.abs(dx) / 5;
                    const turbulence = Math.sin(time * 2 + i * 0.5) * 0.1 * distFromCenter;
                    positions[i*3+1] += turbulence * deltaTime * 2;
                    positions[i*3+2] += Math.cos(time * 1.5 + i * 0.3) * 0.08 * distFromCenter * deltaTime * 2;
                    
                    opacities[i] = Math.max(0.05, 0.35 - distFromCenter * 0.15);
                }
            }
            
            trail.geometry.attributes.position.needsUpdate = true;
            trail.geometry.attributes.opacity.needsUpdate = true;
        }
    }
}

// ─────────────────────────────────────────────
// FLOW ARROW MANAGER
// Spawns velocity-colored 3D ArrowHelpers on click
// ─────────────────────────────────────────────
class FlowArrowManager {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.arrows = [];    // { arrow, age, maxAge }
        this.MAX_ARROWS = 10;
        this.visible = true;
    }

    /**
     * Spawn an arrow at `point` pointing in `direction` with given `speed`.
     * @param {THREE.Vector3} point      - World-space hit point
     * @param {THREE.Vector3} direction  - Normalised flow direction vector
     * @param {number}        speed      - Local flow speed (m/s)
     * @param {number}        maxSpeed   - Reference max speed for colour mapping
     */
    spawnArrow(point, direction, speed, maxSpeed) {
        // FIFO: remove oldest if at cap
        if (this.arrows.length >= this.MAX_ARROWS) {
            const oldest = this.arrows.shift();
            this.group.remove(oldest.arrow);
            oldest.arrow.line.geometry.dispose();
            oldest.arrow.cone.geometry.dispose();
        }

        // Colour: slow = red (0°), fast = cyan (190°) in HSL
        const t = Math.min(1.0, Math.max(0.0, speed / maxSpeed));
        const hue = t * 0.52;   // 0.0 (red) → 0.52 (cyan)
        const color = new THREE.Color().setHSL(hue, 1.0, 0.55);

        // Length: 0.6 (slow) → 3.2 (fast)
        const length = 0.6 + t * 2.6;
        const headLength = length * 0.28;
        const headWidth  = headLength * 0.5;

        const arrow = new THREE.ArrowHelper(
            direction.clone().normalize(),
            point,
            length,
            color,
            headLength,
            headWidth
        );

        // Semi-transparent
        arrow.line.material.transparent = true;
        arrow.cone.material.transparent = true;
        arrow.line.material.opacity = 0.92;
        arrow.cone.material.opacity = 0.92;

        this.group.add(arrow);
        this.arrows.push({ arrow, age: 0, maxAge: 4.0 }); // 4s lifetime
    }

    clear() {
        for (const { arrow } of this.arrows) {
            this.group.remove(arrow);
            arrow.line.geometry.dispose();
            arrow.cone.geometry.dispose();
        }
        this.arrows = [];
    }

    /** Called every frame with deltaTime */
    update(dt) {
        const toRemove = [];
        for (const entry of this.arrows) {
            entry.age += dt;
            const frac = entry.age / entry.maxAge;
            const opacity = Math.max(0, 1.0 - frac);
            entry.arrow.line.material.opacity = opacity * 0.92;
            entry.arrow.cone.material.opacity = opacity * 0.92;
            if (frac >= 1.0) toRemove.push(entry);
        }
        for (const entry of toRemove) {
            this.group.remove(entry.arrow);
            entry.arrow.line.geometry.dispose();
            entry.arrow.cone.geometry.dispose();
            this.arrows.splice(this.arrows.indexOf(entry), 1);
        }
    }

    setVisible(v) {
        this.visible = v;
        this.group.visible = v;
    }
}

// ─────────────────────────────────────────────
// UNIT SYSTEM
// Singleton that converts and formats all displayed values
// ─────────────────────────────────────────────
const UnitSystem = {
    mode: 'metric',   // 'metric' | 'imperial'

    toggle() {
        this.mode = this.mode === 'metric' ? 'imperial' : 'metric';
    },

    // --- converters ---
    speed(ms)     { return this.mode === 'metric' ? ms          : ms  * 2.23694; },
    speedUnit()   { return this.mode === 'metric' ? 'm/s'       : 'mph'; },

    force(N)      { return this.mode === 'metric' ? N           : N   / 4.44822; },
    forceUnit()   { return this.mode === 'metric' ? 'N'         : 'lbf'; },

    pressure(Pa)  { return this.mode === 'metric' ? Pa          : Pa  / 249.089; },
    pressureUnit(){ return this.mode === 'metric' ? 'Pa'        : 'inH\u2082O'; },

    kmh(kmh)      { return this.mode === 'metric' ? kmh         : kmh * 0.621371; },
    kmhUnit()     { return this.mode === 'metric' ? 'km/h'      : 'mph'; },

    // --- formatters ---
    fmtSpeed(ms, dec=1)    { return `${this.speed(ms).toFixed(dec)} ${this.speedUnit()}`; },
    fmtForce(N,  dec=2)    { return `${this.force(N).toFixed(dec)} ${this.forceUnit()}`; },
    fmtPressure(Pa, dec=2) { return `${this.pressure(Pa).toFixed(dec)} ${this.pressureUnit()}`; },
    fmtKmh(kmh, dec=1)     { return `${this.kmh(kmh).toFixed(dec)} ${this.kmhUnit()}`; },
};

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

        // Cached raw metric values for unit conversion
        this._rawMetrics = null;
        this._rawProbeP = null;
        this._rawProbeU = null;
        this._rawSpeedGain = null;
        
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
        this.flowArrows   = new FlowArrowManager(this.scene);
        this.wireframeHelper = null;  // BoxHelper for debug
        this.wireframeActive = false;
        
        // Physics paths generated after model loads (see updateModel)
        // Initial placeholder until OBJ finishes loading:
        this._physicsPathsPending = true;

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onMouseClick(e));
        
        document.getElementById('btn-reset-view').addEventListener('click', () => this.resetCamera());
        
        // Force panel click to close
        document.getElementById('force-panel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideForcePanel();
            this.probeLocked = false;
            this.probeMarker.visible = false;
        });
        
        const velocitySlider = document.getElementById('slider-velocity');
        const velocityVal = document.getElementById('velocity-val');
        if (velocitySlider) {
            velocitySlider.addEventListener('input', (e) => {
                this.v_wind = parseFloat(e.target.value);
                velocityVal.innerText = UnitSystem.fmtSpeed(this.v_wind).toUpperCase();
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
        
        document.getElementById('check-smoke')?.addEventListener('change', (e) => {
            if(this.flowParticles && this.flowParticles.smokeTrails) {
                this.flowParticles.smokeTrails.forEach(trail => {
                    trail.visible = e.target.checked;
                });
            }
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
            // vortex particles are part of the main particle cloud — toggle the whole group
            if(this.flowParticles) this.flowParticles.group.visible = e.target.checked;
        });

        document.getElementById('check-flow-arrows')?.addEventListener('change', (e) => {
            if(this.flowArrows) this.flowArrows.setVisible(e.target.checked);
        });

        document.getElementById('check-wireframe')?.addEventListener('change', (e) => {
            this.wireframeActive = e.target.checked;
            // Toggle solid material wireframe property
            if (this.carMaterial) {
                this.carMaterial.wireframe = this.wireframeActive;
            }
            // Toggle BoxHelper
            if (this.wireframeHelper) {
                this.wireframeHelper.visible = this.wireframeActive;
            }
        });

        // Unit system toggle
        const btnUnit = document.getElementById('btn-unit-toggle');
        if (btnUnit) {
            btnUnit.addEventListener('click', () => {
                UnitSystem.toggle();
                this._refreshAllUnits();
                // Update button labels
                document.getElementById('unit-label-metric').classList.toggle('unit-active', UnitSystem.mode === 'metric');
                document.getElementById('unit-label-imperial').classList.toggle('unit-active', UnitSystem.mode === 'imperial');
            });
        }

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
        this._rawSpeedGain = metrics.top_speed_gain;
        
        document.getElementById('perf-lap-delta').innerText = `${sign}${delta.toFixed(2)}s`;
        document.getElementById('perf-lap-delta').style.color = color;
        document.getElementById('perf-speed-gain').innerText = UnitSystem.fmtKmh(metrics.top_speed_gain);
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
        
        // Create force vectors visualization group
        this.forceVectorsGroup = new THREE.Group();
        this.scene.add(this.forceVectorsGroup);
    }

    resetCamera() {
        this.camera.position.set(-15, 8, 15);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * Generate physically-plausible streamlines around the car's real AABB.
     * Uses a Rankine-body inspired potential flow model:
     *  - Uniform upstream flow in +X direction
     *  - Deflection field computed from the AABB half-extents
     *  - Bernoulli acceleration where local cross-section narrows
     *  - Low-velocity wake downstream
     *  - Zero penetration enforced by clamping paths outside the AABB
     *
     * @param {number} numPaths - number of streamlines to generate
     * @returns {Array} array of coordinate-arrays [[x,y,z], ...]
     */
    generatePhysicsPaths(numPaths = 40) {
        // --- Get real AABB from car geometry ---
        let bbox = new THREE.Box3();
        if (this.car && this.car.geometry) {
            this.car.geometry.computeBoundingBox();
            bbox.copy(this.car.geometry.boundingBox);
            // Apply car's world transform (position.y = -1.5, etc.)
            bbox.applyMatrix4(this.car.matrixWorld);
        } else {
            // Fallback: small box at origin
            bbox.setFromCenterAndSize(new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(4, 1.5, 2));
        }

        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size   = new THREE.Vector3();
        bbox.getSize(size);

        // Half-extents with a small margin
        const hx = size.x * 0.5 + 0.3;
        const hy = size.y * 0.5 + 0.3;
        const hz = size.z * 0.5 + 0.3;

        // Stream domain: upstream from -14 to downstream +14 in X
        const xStart = center.x - 14;
        const xEnd   = center.x + 14;
        const steps  = 40;
        const stepX  = (xEnd - xStart) / (steps - 1);

        // Spawn Y/Z coords on a grid slightly wider than the body
        const spreadY = hy * 2.8;
        const spreadZ = hz * 2.8;
        const paths = [];

        for (let i = 0; i < numPaths; i++) {
            // Distribute streamline seeds uniformly (jittered grid)
            const baseY = center.y + (((i % 7) / 6) - 0.5) * spreadY * 2 + (Math.random() - 0.5) * 0.4;
            const baseZ = center.z + (Math.floor(i / 7) / Math.ceil(numPaths / 7) - 0.5) * spreadZ * 2 + (Math.random() - 0.5) * 0.4;

            const pts = [];
            let curY = baseY;
            let curZ = baseZ;

            for (let j = 0; j < steps; j++) {
                const x = xStart + j * stepX;
                const dx = x - center.x;   // relative to body center
                const dy = curY - center.y;
                const dz = curZ - center.z;

                // Normalised distance from box surface in each axis
                const qx = Math.abs(dx) / hx;
                const qy = Math.abs(dy) / hy;
                const qz = Math.abs(dz) / hz;

                // Potential-flow-inspired influence radius (1.8× the body half-extents)
                const influence = 1.8;

                // Is this point inside the influence zone?
                const inInfluenceY = qy < influence;
                const inInfluenceZ = qz < influence;
                const nearBody     = qx < influence && inInfluenceY && inInfluenceZ;

                if (nearBody) {
                    // Compute a smooth displacement field that pushes flow away from the body
                    // The displacement decays to 0 at the influence boundary (smooth)
                    const blendY = Math.max(0, 1.0 - qy / influence);
                    const blendZ = Math.max(0, 1.0 - qz / influence);
                    const blendX = Math.max(0, 1.0 - qx / influence);
                    const totalBlend = blendX * Math.max(blendY, blendZ);

                    // Direction away from body surface (signed)
                    const signY = dy >= 0 ? 1 : -1;
                    const signZ = dz >= 0 ? 1 : -1;

                    // Primary deflection: push in the direction already offset
                    // (whichever axis is most "open")
                    let defY = 0, defZ = 0;
                    if (Math.abs(dy) / hy >= Math.abs(dz) / hz) {
                        defY = signY * hy * totalBlend * 1.4;
                        defZ = signZ * hz * totalBlend * 0.4;
                    } else {
                        defZ = signZ * hz * totalBlend * 1.4;
                        defY = signY * hy * totalBlend * 0.4;
                    }

                    curY += defY * stepX / hx;
                    curZ += defZ * stepX / hz;
                }

                // ── Wake: downstream turbulent region ──────────────────
                // Reduced velocity + Gaussian perturbation mimicking turbulent wake
                const isWake = dx > 0 && Math.abs(dy) < hy * 1.3 && Math.abs(dz) < hz * 1.3;
                if (isWake) {
                    const wakeFade = Math.exp(-dx / (hx * 2.5));  // decays away from body
                    curY += (Math.random() - 0.5) * 0.08 * wakeFade;
                    curZ += (Math.random() - 0.5) * 0.08 * wakeFade;
                }

                // ── Hard clamp: never enter the solid AABB ─────────────
                // If the path somehow enters the bounding box, push it to the nearest face
                const inside =
                    x  > center.x - hx && x  < center.x + hx &&
                    curY > center.y - hy && curY < center.y + hy &&
                    curZ > center.z - hz && curZ < center.z + hz;

                if (inside) {
                    // Push to nearest face along Y or Z
                    const overlapY = hy - Math.abs(curY - center.y);
                    const overlapZ = hz - Math.abs(curZ - center.z);
                    if (overlapY <= overlapZ) {
                        curY = center.y + (curY >= center.y ? hy : -hy) * 1.01;
                    } else {
                        curZ = center.z + (curZ >= center.z ? hz : -hz) * 1.01;
                    }
                }

                pts.push([x, curY, curZ]);
            }
            paths.push(pts);
        }
        return paths;
    }

    /** @deprecated kept for reference only */
    generateMockPaths() {
        return this.generatePhysicsPaths();
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

        // Update flow particles with car center
        if(this.flowParticles) {
            this.flowParticles.setCarCenter(new THREE.Vector3(0, -1.5, 0));
        }

        // Re-generate physics-based streamlines with the real model AABB.
        // We wait one frame so matrixWorld is updated after position.y is set.
        requestAnimationFrame(() => {
            this.renderer.render(this.scene, this.camera); // force matrix update
            const paths = this.generatePhysicsPaths(50);
            this.flowParticles.updateStreamlines(paths);
            this._physicsPathsPending = false;

            // Refresh wireframe helper with new geometry
            if (this.wireframeHelper) {
                this.scene.remove(this.wireframeHelper);
                this.wireframeHelper.dispose?.();
            }
            this.wireframeHelper = new THREE.BoxHelper(this.car, 0x00ff88);
            this.wireframeHelper.visible = this.wireframeActive;
            this.scene.add(this.wireframeHelper);
            
            // Update car center for flow visualization
            if(this.flowParticles) {
                const box = new THREE.Box3().setFromObject(this.car);
                const carCenter = new THREE.Vector3();
                box.getCenter(carCenter);
                this.flowParticles.setCarCenter(carCenter);
            }
        });
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
                this._rawMetrics = data.metrics;
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
                    // Store for arrow direction sampling
                    this._streamlines = offsetStreamlines;
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
        document.getElementById('val-downforce').innerText = UnitSystem.fmtForce(metrics.downforce);
        document.getElementById('val-drag').innerText = UnitSystem.fmtForce(metrics.drag);
        document.getElementById('val-eff').innerText = `Eff: ${metrics.efficiency.toFixed(2)}`;
        // Update label units
        const dfLabel = document.getElementById('label-downforce-unit');
        const dgLabel = document.getElementById('label-drag-unit');
        if (dfLabel) dfLabel.innerText = UnitSystem.forceUnit();
        if (dgLabel) dgLabel.innerText = UnitSystem.forceUnit();
        // Update the header unit label
        const hdrLabel = document.getElementById('label-df-drag-header');
        if (hdrLabel) hdrLabel.innerText = `Downforce / Drag (${UnitSystem.forceUnit()})`;
        // Update bar widths (use raw N for % calc always)
        const dfPct = Math.min(100, Math.max(0, (metrics.downforce / 500) * 100));
        const dgPct = Math.min(100, Math.max(0, (metrics.drag   / 200) * 100));
        document.getElementById('bar-downforce').style.width = `${dfPct}%`;
        document.getElementById('bar-drag').style.width = `${dgPct}%`;
    }

    /** Re-renders all unit-dependent labels using cached raw metric values */
    _refreshAllUnits() {
        // Velocity slider label
        const velocityVal = document.getElementById('velocity-val');
        if (velocityVal) velocityVal.innerText = UnitSystem.fmtSpeed(this.v_wind).toUpperCase();
        // Sim metrics
        if (this._rawMetrics) {
            this.updateUI(this._rawMetrics);
            this.updateSensorsView(this._rawMetrics);
        }
        // Probe values
        if (this._rawProbeP !== null && this._rawProbeU !== null) {
            document.getElementById('probe-p').innerHTML =
                `${UnitSystem.fmtPressure(this._rawProbeP)} <span class="text-sm">${UnitSystem.pressureUnit()}</span>`;
            document.getElementById('probe-u').innerHTML =
                `${UnitSystem.fmtSpeed(this._rawProbeU)} <span class="text-sm">${UnitSystem.speedUnit()}</span>`;
        }
        // Track speed gain
        if (this._rawSpeedGain !== null) {
            document.getElementById('perf-speed-gain').innerText = UnitSystem.fmtKmh(this._rawSpeedGain);
        }
        // Sensor table pressure column header
        const sensorPressureHeader = document.getElementById('sensor-pressure-header');
        if (sensorPressureHeader) sensorPressureHeader.innerText = `Pressure (${UnitSystem.pressureUnit()})`;
    }

    onMouseMove(event) {
        if (this.probeLocked) return;
        this.updateMouseCoords(event);
        this.updateProbe();
    }

    onMouseClick(event) {
        this.updateMouseCoords(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Use recursive intersect on carGroup so yaw rotation is handled correctly
        const intersects = this.raycaster.intersectObjects([this.carGroup], true);

        if (intersects.length > 0) {
            this.probeLocked = !this.probeLocked;
            this.probeMarker.visible = true;
            this.probeMarker.position.copy(intersects[0].point);
            this.updateProbe();

            // Show force panel and vectors
            this.showForcePanel(intersects[0]);

            // Spawn arrow on every click when the option is enabled.
            // Offset origin along the face normal so the arrow tail
            // sits ON the surface instead of inside the mesh.
            if (this.flowArrows && this.flowArrows.visible) {
                const hitPoint  = intersects[0].point;
                const hitObject = intersects[0].object;
                const faceNormal = intersects[0].face
                    ? intersects[0].face.normal.clone()
                          .transformDirection(hitObject.matrixWorld)
                          .normalize()
                    : new THREE.Vector3(0, 1, 0);

                // Place tail slightly outside the surface
                const arrowOrigin = hitPoint.clone().addScaledVector(faceNormal, 0.18);

                const dir   = this._sampleFlowDirection(hitPoint);
                const speed = this._rawProbeU !== null ? this._rawProbeU : this.v_wind * 0.8;
                this.flowArrows.spawnArrow(arrowOrigin, dir, speed, this.v_wind);
            }
        } else {
            this.probeLocked = false;
            this.probeMarker.visible = false;
            this.hideForcePanel();
        }
    }

    showForcePanel(intersection) {
        const panel = document.getElementById('force-panel');
        if (!panel) return;
        
        const point = intersection.point;
        const faceNormal = intersection.face 
            ? intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld).normalize()
            : new THREE.Vector3(1, 0, 0);
        
        // Calculate forces at this point
        const distFromFront = point.x - this.carGroup.position.x;
        
        // Pressure force (Bernoulli)
        const p_static = 101325;
        const dynamicP = 0.5 * 1.225 * this.v_wind * this.v_wind;
        const pressure = p_static + dynamicP * (1 - Math.abs(distFromFront) / 5);
        
        // Velocity
        const velocity = this.v_wind * (0.4 + 0.6 * (distFromFront / 10));
        
        // Drag component (pressure drag)
        const dragForce = pressure * 0.01 * Math.max(0, distFromFront);
        
        // Downforce component
        const downforce = pressure * 0.005 * (1 - Math.abs(distFromFront) / 8);
        
        // Shear stress (viscous)
        const shearStress = 0.5 * 1.225 * velocity * velocity * 0.003;
        
        // Create force data
        const forces = [
            { name: 'Pressure', value: pressure, unit: 'Pa', color: '#ff6b6b' },
            { name: 'Velocity', value: velocity, unit: 'm/s', color: '#4ecdc4' },
            { name: 'Drag Force', value: dragForce, unit: 'N', color: '#ffe66d' },
            { name: 'Downforce', value: downforce, unit: 'N', color: '#95e1d3' },
            { name: 'Shear', value: shearStress, unit: 'Pa', color: '#a8e6cf' }
        ];
        
        // Update panel
        const forceList = document.getElementById('force-list');
        forceList.innerHTML = '';
        
        forces.forEach(force => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center';
            item.innerHTML = `
                <span class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${force.color}"></span>
                    <span class="text-on-surface-variant">${force.name}</span>
                </span>
                <span class="font-mono font-bold" style="color: ${force.color}">${force.value.toFixed(2)} <span class="text-[9px] text-slate-500">${force.unit}</span></span>
            `;
            forceList.appendChild(item);
        });
        
        panel.classList.remove('opacity-0');
        
        // Draw 3D force vectors
        this.drawForceVectors(point, faceNormal, forces);
    }

    hideForcePanel() {
        const panel = document.getElementById('force-panel');
        if (panel) {
            panel.classList.add('opacity-0');
        }
        
        // Clear 3D force vectors
        this.clearForceVectors();
    }

    drawForceVectors(point, normal, forces) {
        this.clearForceVectors();
        
        const origin = point.clone();
        
        // Direction vectors for different forces
        const flowDir = new THREE.Vector3(1, 0, 0);
        const upDir = new THREE.Vector3(0, 1, 0);
        const dragDir = normal.clone().negate();
        
        const forceConfigs = [
            { direction: flowDir, value: forces[1].value / 10, color: 0x4ecdc4, name: 'velocity' },
            { direction: dragDir, value: forces[2].value / 100, color: 0xffe66d, name: 'drag' },
            { direction: upDir, value: forces[3].value / 100, color: 0x95e1d3, name: 'downforce' },
            { direction: normal.clone().negate(), value: forces[0].value / 1000, color: 0xff6b6b, name: 'pressure' }
        ];
        
        forceConfigs.forEach((config) => {
            const length = Math.min(3, Math.max(0.3, config.value));
            const arrow = new THREE.ArrowHelper(
                config.direction,
                origin.clone(),
                length,
                config.color,
                length * 0.25,
                length * 0.12
            );
            
            arrow.line.material.transparent = true;
            arrow.line.material.opacity = 0.9;
            arrow.cone.material.transparent = true;
            arrow.cone.material.opacity = 0.9;
            
            this.forceVectorsGroup.add(arrow);
        });
    }

    clearForceVectors() {
        while(this.forceVectorsGroup.children.length > 0) {
            const arrow = this.forceVectorsGroup.children[0];
            this.forceVectorsGroup.remove(arrow);
            arrow.dispose?.();
        }
    }

    /**
     * Estimate local flow direction at a world-space point.
     * Finds the nearest stream-path segment and returns the tangent at that point.
     * Falls back to the global wind direction if no streamlines are loaded.
     */
    _sampleFlowDirection(point) {
        const defaultDir = new THREE.Vector3(1, 0, 0); // wind flows in +X

        if (!this._streamlines || this._streamlines.length === 0) return defaultDir;

        let bestDist = Infinity;
        let bestDir = defaultDir.clone();

        for (const path of this._streamlines) {
            const coords = path.coords;
            for (let i = 0; i < coords.length - 1; i++) {
                const a = new THREE.Vector3(coords[i][0],   coords[i][1],   coords[i][2]);
                const b = new THREE.Vector3(coords[i+1][0], coords[i+1][1], coords[i+1][2]);
                // Closest point on segment to hit point
                const ab = b.clone().sub(a);
                const t  = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / ab.lengthSq()));
                const closest = a.clone().add(ab.clone().multiplyScalar(t));
                const dist = closest.distanceTo(point);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDir  = ab.clone().normalize();
                }
            }
        }

        return bestDir;
    }

    updateMouseCoords(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    updateProbe() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects([this.carGroup], true);
        const hud = document.getElementById('probe-hud');

        if (intersects.length > 0) {
            hud.classList.remove('opacity-0');
            const point = intersects[0].point;
            const distFromFront = point.x - (-3);
            // Raw metric values
            const p_Pa = Math.max(-250, 180 * (1 - distFromFront/6) + (Math.sin(performance.now()*0.01) * 3));
            const u_ms = this.v_wind * (0.4 + 0.6 * (distFromFront/6));
            const cp   = p_Pa / (0.5 * 1.225 * this.v_wind**2);

            // Cache for unit refresh
            this._rawProbeP = p_Pa;
            this._rawProbeU = u_ms;

            document.getElementById('probe-p').innerHTML =
                `${UnitSystem.pressure(p_Pa).toFixed(2)} <span class="text-sm">${UnitSystem.pressureUnit()}</span>`;
            document.getElementById('probe-u').innerHTML =
                `${UnitSystem.speed(u_ms).toFixed(2)} <span class="text-sm">${UnitSystem.speedUnit()}</span>`;
            document.getElementById('probe-cp').innerText = `Cp: ${cp.toFixed(2)}`;
            
            // Also sync to Sensores macro gauge (always Pa for raw data)
            document.getElementById('sensor-val-pressure').innerText = UnitSystem.pressure(p_Pa).toFixed(1);
            
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
        
        // Generate initial physics paths once the model is ready (deferred load)
        if (this._physicsPathsPending && this.car && this.car.geometry &&
            this.car.geometry.attributes && this.car.geometry.attributes.position) {
            this._physicsPathsPending = false;
            const paths = this.generatePhysicsPaths(50);
            this.flowParticles.updateStreamlines(paths);
        }

        // Update BoxHelper to track any transforms
        if (this.wireframeHelper && this.wireframeActive) {
            this.wireframeHelper.update();
        }

        // Update true Transient Backend Frames
        const dt = this.clock.getDelta();
        if (this.flowParticles && this.flowParticles.group.visible) {
            this.flowParticles.updateParticles(dt, this.loopDuration);
        }

        // Update flow arrow fade-outs
        if (this.flowArrows) {
            this.flowArrows.update(dt);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new WindTunnelApp();


