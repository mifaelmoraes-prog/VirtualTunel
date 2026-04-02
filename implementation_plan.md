# Virtual Wind Tunnel (VWT) Implementation Plan

Building a professional CFD-based wind tunnel simulation for automotive engineering.

## Proposed Changes

### [Backend] High-Performance Aero Engine
The backend will handle heavy CFD computations and mesh processing.

#### [NEW] `backend/`
- **Framework**: FastAPI (Python) for high-performance async API.
- **CFD Engine**: OpenFOAM (simpleFoam) for steady-state RANS simulations.
- **Turbulence Model**: k-omega SST.
- **Mesh Processing**: `pyvista`, `meshio`, and `PyFOAM` for automation.
- **Post-Processing**: Paraview/VTK libraries to generate `.vtk` slices and streamline data.

### [Frontend] Professional Web Dashboard
A Three.js based visualization platform.

#### [NEW] `frontend/`
- **Framework**: React + Vite + TailwindCSS.
- **Visualization**: Three.js / React Three Fiber.
- **Key Features**:
  - Custom Shaders for Pressure Maps.
  - Particle Systems for Streamlines.
  - Interactive Probe Tool using Raycasting to sample CFD data.
  - Iteration Comparator (Side-by-side view).

### [Mobile] Scanner & AR Preview
A mobile companion for data acquisition and field visualization.

#### [NEW] `mobile/`
- **Framework**: Expo / React Native.
- **AR Engine**: Expo AR (Viro or ARKit/ARCore).
- **Scanner**: LiDAR API integration for point cloud acquisition.
- **Optimization**: Algorithmic filters for metallic reflection rejection.

## Phase 1: Core Foundation (Next Steps)
1.  Initialize the mono-repo structure.
2.  Set up the 3D rendering pipeline in the frontend.
3.  Implement a basic CFD job queue in the backend.

## Verification Plan

### Automated Tests
-   **Backend**: Unit tests for $C_d$ and $C_l$ calculation logic. Validation against known benchmark models (e.g., Ahmed Body).
-   **Frontend**: Rendering performance benchmarks for large point clouds.

### Manual Verification
-   Visual inspection of streamlines in the 3D viewer.
-   End-to-end test: Scan a simple object (cube/sphere) -> Process in CFD -> View AR flow.
