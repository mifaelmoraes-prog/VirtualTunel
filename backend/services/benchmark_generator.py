import pyvista as pv
import numpy as np
import os

class BenchmarkGenerator:
    """
    Procedural generation of industry-standard automotive benchmarks.
    """
    
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)

    def generate_ahmed_body(self, slant_angle=25, length=1.044, width=0.389, height=0.288):
        """
        Generates a simplified Ahmed Body (1:4 scale default).
        """
        # 1. Main body (box)
        body = pv.Box(bounds=(0, length, -width/2, width/2, 0, height))
        
        # 2. Rounded front (Cylinder/Sphere intersection or just a rounded box if possible)
        # For simplicity, we'll use a subdivided box and smooth the front
        front_rounded = body.clip('x', origin=(0.1 * length, 0, 0), invert=True)
        # (This is a bit complex for a one-liner, let's use a more robust way)
        
        # Simplified Ahmed: Box + Slant
        # Points for a box with a slant at the back
        # Back is length, slant starts at length - (height * tan(slant_angle))
        slant_start = length * 0.8
        
        points = np.array([
            [0, -width/2, 0], [length, -width/2, 0], [length, width/2, 0], [0, width/2, 0], # bottom
            [0, -width/2, height], [slant_start, -width/2, height], [slant_start, width/2, height], [0, width/2, height], # top front
            [length, -width/2, height/2], [length, width/2, height/2] # back slant points
        ])
        
        # Define faces
        faces = [
            [4, 0, 1, 2, 3], # bottom
            [4, 4, 5, 6, 7], # top front
            [4, 0, 4, 7, 3], # front
            [4, 1, 8, 9, 2], # back
            [4, 5, 8, 9, 6], # top slant
            [4, 0, 4, 5, 1], # left front
            [4, 1, 5, 8, 1], # left slant (triangle-ish) - wait, this is wrong
        ]
        # Let's use pyvista's primitive and modify it or use a more standard box
        ahmed = pv.Box(bounds=(0, length, -width/2, width/2, 0.05, height + 0.05))
        ahmed = ahmed.triangulate()
        
        # Apply slant by moving back-upper points down
        pts = ahmed.points
        mask = (pts[:, 0] > slant_start) & (pts[:, 2] > height/2)
        # Scale z relative to x to create a slant
        for i in np.where(mask)[0]:
            z_top = height + 0.05
            z_slant = z_top - (pts[i, 0] - slant_start) * np.tan(np.radians(slant_angle))
            pts[i, 2] = max(0.1, z_slant)
            
        output_path = os.path.join(self.data_dir, "ahmed_body.stl")
        ahmed.save(output_path)
        return output_path

    def generate_drivaer(self):
        """
        Generates a simplified DrivAer-like generic sedan.
        """
        # Use a combination of boxes for hood, cabin, and trunk
        hood = pv.Box(bounds=(0, 1.5, -0.9, 0.9, 0.1, 0.8))
        cabin = pv.Box(bounds=(1.5, 3.5, -0.9, 0.9, 0.1, 1.5))
        trunk = pv.Box(bounds=(3.5, 4.5, -0.9, 0.9, 0.1, 0.9))
        
        car = hood.merge(cabin).merge(trunk).triangulate().smooth(n_iter=20)
        
        output_path = os.path.join(self.data_dir, "drivaer_model.stl")
        car.save(output_path)
        return output_path

if __name__ == "__main__":
    gen = BenchmarkGenerator(data_dir="../data") # relative to services/
    gen.generate_ahmed_body()
    gen.generate_drivaer()
