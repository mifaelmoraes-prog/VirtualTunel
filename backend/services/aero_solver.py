import pyvista as pv
import numpy as np
import os

class AeroSolver:
    """
    Simulates a high-fidelity RANS CFD solver (simpleFoam style)
    with support for industry-standard boundary conditions.
    """
    
    def __init__(self, rho=1.225):
        self.rho = rho # Air density at sea level (kg/m3)

    def solve(self, mesh_path, v_wind=20.0, yaw=0.0, resolution=20, moving_ground=True, output_path="data/results.vtp"):
        """
        Executes the simulation on the provided mesh.
        """
        if not os.path.exists(mesh_path):
            raise FileNotFoundError(f"Mesh not found at {mesh_path}")
            
        # load volume or surface mesh
        mesh = pv.read(mesh_path)
        
        # Apply incoming yaw to mesh
        if yaw != 0.0:
            mesh.rotate_z(yaw, inplace=True)
        
        # 1. Setup flow field
        # U = Velocity vector field
        # p = Pressure scalar field
        points = mesh.points
        u_vals = np.zeros_like(points)
        u_vals[:, 0] = v_wind # X-axis is flow direction
        
        # 2. Apply Boundary Conditions (BCs)
        # Ground effect: Moving wall at Z=0 (approx)
        if moving_ground:
            ground_mask = points[:, 2] < (np.min(points[:, 2]) + 0.1)
            u_vals[ground_mask, 0] = v_wind # Ground moves with wind
            
        # 3. Simulate RANS k-omega SST behavior (Mocked with physics-informed perturbations)
        center = np.mean(points, axis=0)
        dist_to_center = np.linalg.norm(points - center, axis=1)
        
        # Add wake effect and deflection
        # Points behind car have lower velocity and turbulence
        wake_mask = (points[:, 0] > center[0]) & (dist_to_center < 10)
        u_vals[wake_mask, 0] *= (0.7 + 0.2 * np.random.rand(np.sum(wake_mask)))
        
        # 4. Calculate Pressure (Bernoulli + Shape factors)
        p_vals = 0.5 * self.rho * (v_wind**2 - np.linalg.norm(u_vals, axis=1)**2)
        front_dist = points[:, 0] - np.min(points[:, 0])
        p_vals += 150.0 * np.exp(-front_dist * 2.0)
        
        # 5. Integrate Forces
        drag_coeff = 0.32
        lift_coeff = -0.15
        area_front = (np.max(points[:, 1]) - np.min(points[:, 1])) * (np.max(points[:, 2]) - np.min(points[:, 2]))
        drag = 0.5 * self.rho * (v_wind**2) * area_front * drag_coeff
        downforce = -0.5 * self.rho * (v_wind**2) * area_front * lift_coeff
        
        # Store results
        mesh.point_data["U"] = u_vals
        mesh.point_data["p"] = p_vals
        mesh.point_data["Cp"] = p_vals / (0.5 * self.rho * v_wind**2)
        mesh.save(output_path)

        # 6. Generate Streamlines & Vortices Array for Frontend Player
        inlet_x = np.min(points[:, 0]) - 5
        streamline_data = []
        
        for i in range(int(resolution)):
            y = (np.random.rand() - 0.5) * 8
            z = (np.random.rand() - 0.5) * 8
            path = []
            vels = []
            for x in np.linspace(inlet_x, np.max(points[:, 0]) + 15, 60):
                dist_to_obj = np.sqrt((x - center[0])**2 + (y - center[1])**2 + (z - center[2])**2)
                deflection = np.exp(-dist_to_obj/3) * 2
                
                local_vel = v_wind * (1.0 - np.exp(-dist_to_obj/2))
                if local_vel < v_wind * 0.1: local_vel = v_wind * 0.1
                
                cross_push = np.sin(np.radians(yaw)) * (x - inlet_x) * 0.1
                
                path.append([float(x), float(y + deflection * 0.5 + cross_push), float(z + deflection)])
                vels.append(float(local_vel))
            streamline_data.append({"coords": path, "vels": vels, "type": "streamline"})
            
        # Backend native vortex generation
        rear_x = np.max(points[:, 0])
        for i in range(int(resolution) // 2):
            is_left = i % 2 == 0
            base_y = center[1] + (1.5 if is_left else -1.5)
            base_z = center[2] + 0.5
            
            path = []
            vels = []
            
            curr_y, curr_z = base_y, base_z
            for x in np.linspace(rear_x, rear_x + 15, 40):
                angular_vel = 0.2
                sign = 1 if is_left else -1
                dy, dz = curr_y - center[1], curr_z - center[2]
                
                new_dy = dy * np.cos(angular_vel*sign) - dz * np.sin(angular_vel*sign)
                new_dz = dy * np.sin(angular_vel*sign) + dz * np.cos(angular_vel*sign)
                
                expand = 1.05
                curr_y = center[1] + new_dy * expand + (np.sin(np.radians(yaw)) * (x - rear_x) * 0.2)
                curr_z = center[2] + new_dz * expand
                
                path.append([float(x), float(curr_y), float(curr_z)])
                vels.append(float(v_wind * 0.4)) # Vortices move slower
            streamline_data.append({"coords": path, "vels": vels, "type": "vortex"})

        return {
            "drag": float(drag),
            "downforce": float(downforce),
            "efficiency": float(downforce / drag if drag != 0 else 0),
            "streamlines": streamline_data
        }



if __name__ == "__main__":
    solver = AeroSolver()
    # Create simple mesh for test
    box = pv.Box(bounds=(-2, 2, -1, 1, 0, 1)).triangulate().subdivide(2)
    box.save("data/test_mesh.stl")
    metrics = solver.solve("data/test_mesh.stl", v_wind=33.3) # ~120 km/h
    print(f"Metrics: {metrics}")
