import React, { useState } from 'react';
import WindTunnel from './components/WindTunnel';

function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [sliceCount, setSliceCount] = useState(8);
  const [activeTab, setActiveTab] = useState('simulation');
  const [materialSettings, setMaterialSettings] = useState({
    carColor: '#c9b896',
    metalness: 0.05,
    roughness: 0.85,
    showPressure: true,
    showStreamlines: true,
    showSmoke: true,
    showVortices: false,
  });
  const [simParams, setSimParams] = useState({
    windSpeed: 20.0,
    modelYaw: 0,
    resolution: 20,
    loopDuration: 1.0,
  });
  const [metrics, setMetrics] = useState({
    downforce: 0,
    drag: 0,
    efficiency: 0,
    pressure: 0,
    topSpeedGain: 0,
  });

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setTimeout(() => {
      const randomGain = Math.random() * 5 + 2;
      setMetrics({
        downforce: 142.5 + Math.random() * 20,
        drag: 48.2 + Math.random() * 5,
        efficiency: 2.95 + Math.random() * 0.3,
        pressure: 101.325,
        topSpeedGain: randomGain,
      });
      setIsSimulating(false);
    }, 2000);
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <header>
          <h1 className="title-gradient">VIRTUAL TUNNEL</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Aero Engineering Station v1.0</p>
        </header>

        <section className="glass-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--accent-primary)' }}>📊</span>
            Live Metrics
          </h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">Downforce</span>
              <span className="metric-value">{metrics.downforce.toFixed(1)} <small>N</small></span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Drag</span>
              <span className="metric-value">{metrics.drag.toFixed(1)} <small>N</small></span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Efficiency</span>
              <span className="metric-value">{metrics.efficiency.toFixed(2)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Top Speed Gain</span>
              <span className="metric-value">+{metrics.topSpeedGain.toFixed(1)} <small>km/h</small></span>
            </div>
          </div>
        </section>

        <section className="glass-card">
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem' }}>
            {['simulation', 'visualization', 'material'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab ? '#000' : 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'visualization' ? 'Visual' : tab}
              </button>
            ))}
          </div>

          {activeTab === 'simulation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Wind Speed Base: <strong>{simParams.windSpeed.toFixed(1)} m/s</strong></span>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={simParams.windSpeed}
                    onChange={(e) => setSimParams({ ...simParams, windSpeed: parseFloat(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Model Yaw (Crosswind): <strong>{simParams.modelYaw}°</strong></span>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="1"
                    value={simParams.modelYaw}
                    onChange={(e) => setSimParams({ ...simParams, modelYaw: parseInt(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Resolution: <strong>{simParams.resolution}</strong></span>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={simParams.resolution}
                    onChange={(e) => setSimParams({ ...simParams, resolution: parseInt(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Loop Duration: <strong>{simParams.loopDuration.toFixed(1)} s</strong></span>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={simParams.loopDuration}
                    onChange={(e) => setSimParams({ ...simParams, loopDuration: parseFloat(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'visualization' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                Streamlines
                <input
                  type="checkbox"
                  checked={materialSettings.showStreamlines}
                  onChange={(e) => setMaterialSettings({ ...materialSettings, showStreamlines: e.target.checked })}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                Smoke Trails
                <input
                  type="checkbox"
                  checked={materialSettings.showSmoke}
                  onChange={(e) => setMaterialSettings({ ...materialSettings, showSmoke: e.target.checked })}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                Pressure Heatmap
                <input
                  type="checkbox"
                  checked={materialSettings.showPressure}
                  onChange={(e) => setMaterialSettings({ ...materialSettings, showPressure: e.target.checked })}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                Vortex Visualization
                <input
                  type="checkbox"
                  checked={materialSettings.showVortices}
                  onChange={(e) => setMaterialSettings({ ...materialSettings, showVortices: e.target.checked })}
                />
              </label>
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Cross-Section Slices: <strong>{sliceCount}</strong></span>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={sliceCount}
                    onChange={(e) => setSliceCount(parseInt(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
            </div>
          )}
          {activeTab === 'material' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Car Color</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={materialSettings.carColor}
                      onChange={(e) => setMaterialSettings({ ...materialSettings, carColor: e.target.value })}
                      style={{ width: '40px', height: '30px', border: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={materialSettings.carColor}
                      onChange={(e) => setMaterialSettings({ ...materialSettings, carColor: e.target.value })}
                      style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '0.3rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </label>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Metalness: <strong>{(materialSettings.metalness * 100).toFixed(0)}%</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={materialSettings.metalness}
                    onChange={(e) => setMaterialSettings({ ...materialSettings, metalness: parseFloat(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span>Roughness: <strong>{(materialSettings.roughness * 100).toFixed(0)}%</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={materialSettings.roughness}
                    onChange={(e) => setMaterialSettings({ ...materialSettings, roughness: parseFloat(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Preview</div>
                <div style={{
                  height: '40px',
                  background: materialSettings.carColor,
                  borderRadius: '4px',
                  boxShadow: `inset 0 0 20px rgba(255,255,255,${materialSettings.metalness * 0.3})`,
                  border: '1px solid var(--border-color)'
                }}></div>
              </div>
            </div>
          )}
        </section>

        <button className="btn-primary" onClick={handleRunSimulation} disabled={isSimulating}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span>▶️</span>
            {isSimulating ? 'SIMULATING...' : 'RUN SOLVER'}
          </div>
        </button>

        <footer style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          System Ready | Reynolds: 1.2e6 | SST k-ω
        </footer>
      </aside>

      <main className="viewer-container">
        <WindTunnel
          sliceCount={sliceCount}
          materialSettings={materialSettings}
          showStreamlines={materialSettings.showStreamlines}
          showPressure={materialSettings.showPressure}
          showSmoke={materialSettings.showSmoke}
          showVortices={materialSettings.showVortices}
          windSpeed={simParams.windSpeed}
          modelYaw={simParams.modelYaw}
        />

        <div className="probe-overlay glass-card">
          <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>PROBE DATA</h4>
          <div style={{ fontSize: '0.9rem' }}>
            <div>P: 102.4 kPa</div>
            <div>U: 24.5 m/s</div>
            <div>Cp: 0.85</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
