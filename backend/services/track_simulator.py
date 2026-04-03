import pandas as pd
import numpy as np

class TrackSimulator:
    def __init__(self, telemetry_path):
        self.telemetry_path = telemetry_path
        self.load_telemetry()

    def load_telemetry(self):
        try:
            self.df = pd.read_csv(self.telemetry_path)
            self.baseline_lap_time = len(self.df) # simplified as 1 second per row
        except Exception:
            self.df = pd.DataFrame()
            self.baseline_lap_time = 0

    def analyze_performance(self, cd, cl, frontal_area=2.0):
        """
        Predict performance gain based on Drag (Cd) and Downforce (Cl).
        Simplified physics: 
        - Drag reduces top speed and acceleration.
        - Downforce increases lateral G limits (grip).
        """
        if self.df.empty:
            return {"status": "error", "message": "No telemetry data found"}

        # Reference values (standard car)
        ref_cd = 0.35
        ref_cl = 0.1

        # Drag impact (longitudinal)
        # Force_drag = 0.5 * rho * v^2 * A * Cd
        # Reduced Cd = Higher top speed, better acceleration
        drag_delta = (ref_cd - cd) / ref_cd
        top_speed_gain = drag_delta * 15.0 # km/h estimate

        # Downforce impact (lateral)
        # N = m*g + Aero_downforce
        # Grip = mu * N
        cl_delta = (cl - ref_cl) / ref_cl
        grip_gain = cl_delta * 0.1 # lateral G improvement factor

        # Simulating a new lap
        new_lap_time = 0
        refined_telemetry = []

        for _, row in self.df.iterrows():
            # Acceleration phase (simplified)
            speed_factor = 1.0 + (drag_delta * 0.05 if row['throttle'] > 0.5 else 0)
            
            # Cornering phase (simplified)
            grip_factor = 1.0 + (cl_delta * 0.08 if row['g_lat'] > 0.5 else 0)
            
            # Time segment (1s baseline)
            # v = d/t => t = d/v. If speed is higher, time is lower.
            segment_time = 1.0 / max(speed_factor, grip_factor)
            new_lap_time += segment_time
            
            refined_telemetry.append({
                "speed": float(row['speed'] * speed_factor),
                "g_lat": float(row['g_lat'] * grip_factor),
                "lat": float(row['lat']),
                "lon": float(row['lon'])
            })

        return {
            "status": "success",
            "metrics": {
                "baseline_time": float(self.baseline_lap_time),
                "new_time": float(new_lap_time),
                "delta_time": float(new_lap_time - self.baseline_lap_time),
                "top_speed_gain": float(top_speed_gain),
                "lateral_grip_gain_pct": float(cl_delta * 100)
            },
            "telemetry": refined_telemetry
        }
