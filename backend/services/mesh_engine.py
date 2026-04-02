import pyvista as pv
import numpy as np
import os

class MeshEngine:
    """
    Handles the conversion of raw point clouds (from LiDAR) into watertight
    surface meshes and subsequently into volume meshes for CFD.
    """
    
    @staticmethod
    def point_cloud_to_surface(points_path, output_path="data/surface.stl"):
        """
        Converts a point cloud (.npy, .csv, or .ply) into a surface mesh using 
        Delaunay triangulation or Poisson reconstruction.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Load or generate points if file doesn't exist (for demo)
        if not os.path.exists(points_path):
            print(f"File {points_path} not found. Generating synthetic point cloud.")
            cloud = pv.Box(bounds=(-2, 2, -1, 1, 0, 1)).extract_surface().sample_points(2000)
        else:
            cloud = pv.read(points_path)

        # 1. Clean the point cloud (remove outliers)
        # cloud = cloud.remove_outliers(nb_neighbors=20, std_ratio=2.0)

        # 2. Surface Reconstruction (using Delaunay 3D for simplicity in demo)
        # In a real automotive scenario, we'd use Poisson or Screened Poisson
        surf = cloud.delaunay_3d(alpha=0.5).extract_surface()
        
        # 3. Clean and close holes
        surf = surf.fill_holes(100.0) # Maximum hole size to fill
        
        # 4. Ensure watertight
        if not surf.is_all_triangles:
            surf = surf.triangulate()
            
        surf.save(output_path)
        print(f"Surface mesh saved to {output_path}")
        return surf

    @staticmethod
    def validate_watertight(mesh):
        """
        Checks if the mesh is manifold and closed (essential for CFD).
        """
        edges = mesh.extract_feature_edges(boundary_edges=True, non_manifold_edges=True, feature_edges=False, manifold_edges=False)
        if edges.n_cells > 0:
            print(f"Mesh is NOT watertight! Found {edges.n_cells} open edges.")
            return False, edges
        print("Mesh is watertight and ready for volume meshing.")
        return True, None

    @staticmethod
    def generate_volume_mesh(surface_mesh, output_path="data/volume.vtk"):
        """
        Generates a tetrahedral volume mesh from the surface.
        Uses TetGen (via pyvista) if available.
        """
        # Note: volume meshing usually requires external tools like TetGen or Gmsh
        # pyvista provides a wrapper if tetgen is installed
        try:
            import tetgen
            tgen = tetgen.TetGen(surface_mesh)
            nodes, elems = tgen.make_manifold()
            nodes, elems = tgen.tetrahedralize(order=1, mindihedral=20, minratio=1.5)
            vol = tgen.grid
            vol.save(output_path)
            return vol
        except ImportError:
            print("TetGen not found. Falling back to simple voxelization for demo.")
            # Simple voxel extraction as a fallback
            vol = pv.voxelize(surface_mesh, density=surface_mesh.length/50)
            vol.save(output_path)
            return vol

if __name__ == "__main__":
    engine = MeshEngine()
    surf = engine.point_cloud_to_surface("dummy.ply")
    is_ok, errs = engine.validate_watertight(surf)
    if is_ok:
        engine.generate_volume_mesh(surf)
