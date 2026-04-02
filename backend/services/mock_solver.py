import pyvista as pv
import numpy as np
import os

def generate_mock_aero_data(output_path="data/simulation.vtp"):
    """
    Generates a mock 3D pressure and velocity field for a generic box (car proxy).
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Create a simple box as the "car"
    car = pv.Box(bounds=(-2, 2, -1, 1, 0, 1))
    
    # Create a domain (wind tunnel)
    grid = pv.ImageData(
        dimensions=(40, 20, 20),
        spacing=(0.5, 0.5, 0.5),
        origin=(-10, -5, 0)
    )
    
    # Generate synthetic velocity U (X-dominant)
    # Wind comes from -X (X=-10) to +X
    u_base = 20.0  # 20 m/s (~72 km/h)
    points = grid.points
    u_vals = np.zeros_like(points)
    u_vals[:, 0] = u_base
    
    # Perturb velocity around the "car" area
    # Simple wake effect
    dist_to_car = np.linalg.norm(points - [0, 0, 0.5], axis=1)
    mask_wake = (points[:, 0] > 0) & (dist_to_car < 5)
    u_vals[mask_wake, 0] *= 0.6  # Slow down in wake
    
    # Generate synthetic pressure P
    # Bernoulli: P = 0.5 * rho * (v_ref^2 - v_local^2)
    rho = 1.225
    p_vals = 0.5 * rho * (u_base**2 - np.linalg.norm(u_vals, axis=1)**2)
    
    # Add High pressure at front, Low pressure at rear
    front_mask = (points[:, 0] < -1.8) & (points[:, 0] > -2.2) & (np.abs(points[:, 1]) < 1.2)
    p_vals[front_mask] += 200.0  # Stagnation point
    
    # Store data in grid
    grid.point_data["U"] = u_vals
    grid.point_data["p"] = p_vals
    grid.point_data["Cp"] = p_vals / (0.5 * rho * u_base**2)
    
    # Save as VTK PolyData (or Unstructured Grid)
    grid.save(output_path)
    print(f"Mock simulation data saved to {output_path}")
    return output_path

if __name__ == "__main__":
    generate_mock_aero_data()
