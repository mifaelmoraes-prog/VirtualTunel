from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from services.mock_solver import generate_mock_aero_data
from services.mesh_engine import MeshEngine
from services.aero_solver import AeroSolver
from services.lidar_processor import LiDARProcessor
from services.benchmark_generator import BenchmarkGenerator
import os
import shutil

app = FastAPI(title="Virtual Wind Tunnel API")
gen = BenchmarkGenerator()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Virtual Wind Tunnel Backend is running"}

@app.post("/upload")
async def upload_model(file: UploadFile = File(...)):
    """
    Uploads a model file (STL/OBJ) for simulation.
    """
    if not file.filename.endswith(('.stl', '.obj')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only STL and OBJ accepted.")
    
    file_path = f"data/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"status": "success", "filename": file.filename, "id": file.filename.split('.')[0]}

@app.get("/benchmarks")
def list_benchmarks():
    """
    Lists available benchmark models.
    """
    return {
        "benchmarks": [
            {"id": "ahmed", "name": "Ahmed Body"},
            {"id": "drivaer", "name": "DrivAer Sedan"},
            {"id": "mira", "name": "MIRA Notchback"}
        ]
    }

@app.post("/simulate")
def run_simulation(model_id: str = "default", v_wind: float = 20.0):
    """
    Triggers a high-fidelity CFD simulation.
    """
    try:
        # 1. Resolve model path
        if model_id == "ahmed":
            mesh_path = gen.generate_ahmed_body()
        elif model_id == "drivaer":
            mesh_path = gen.generate_drivaer()
        else:
            mesh_path = f"data/{model_id}.stl"
            if not os.path.exists(mesh_path):
                mesh_path = "data/default_mesh.stl"

        # 2. Run Aero Solver
        output_file = f"data/{model_id}_sim.vtp"
        solver = AeroSolver()
        metrics = solver.solve(mesh_path, v_wind=v_wind, output_path=output_file)
        
        return {
            "status": "success",
            "message": "Simulation completed",
            "output": output_file,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data/{model_id}")
def get_simulation_data(model_id: str):
    """
    Returns the path to the VTK/VTP file for visualization.
    """
    file_path = f"data/{model_id}_sim.vtp"
    if os.path.exists(file_path):
        return {"file": file_path}
    else:
        raise HTTPException(status_code=404, detail="Simulation data not found")

@app.post("/mesh/process")
def process_mesh(points_file: str = "data/input_scan.ply"):
    """
    Converts raw LiDAR point cloud to a watertight volume mesh.
    """
    try:
        engine = MeshEngine()
        surf = engine.point_cloud_to_surface(points_file, "data/processed_surface.stl")
        is_watertight, edges = engine.validate_watertight(surf)
        
        if not is_watertight:
            return {
                "status": "warning",
                "message": "Surface generated but contains holes. CFD might be unstable.",
                "surface": "data/processed_surface.stl"
            }
            
        vol = engine.generate_volume_mesh(surf, "data/processed_volume.vtk")
        return {
            "status": "success",
            "message": "Volume mesh generated successfully",
            "surface": "data/processed_surface.stl",
            "volume": "data/processed_volume.vtk"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/lidar/clean")
def clean_scan(file_path: str = "data/raw_scan.ply"):
    """
    Cleans raw LiDAR scan from metallic reflections.
    """
    try:
        proc = LiDARProcessor()
        cleaned = proc.clean_reflections(file_path)
        output = "data/cleaned_scan.stl"
        cleaned.extract_surface().save(output) # Convert to surface for preview
        return {"status": "success", "output": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ar/asset/{model_id}")
def get_ar_asset(model_id: str):
    """
    Returns an AR-ready GLB asset for the mobile app.
    """
    try:
        sim_path = f"data/{model_id}_sim.vtp"
        output_glb = f"data/{model_id}_flow.glb"
        proc = LiDARProcessor()
        asset = proc.prepare_ar_asset(sim_path, output_glb)
        if asset:
            return {"status": "success", "url": f"/static/{output_glb}"}
        else:
            return {"status": "error", "message": "Simulation results not ready"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
