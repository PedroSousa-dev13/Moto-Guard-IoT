import json
import subprocess

def test_anomaly():
    # Normal data
    normal_points = [
        {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
        {"speedKmh": 52, "rpm": 3100, "rollDeg": 6, "gForce": 1.1},
        {"speedKmh": 54, "rpm": 3200, "rollDeg": 5, "gForce": 1.0}
    ]
    
    # Anomaly: Sudden speed change
    anomaly_points = [
        {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
        {"speedKmh": 75, "rpm": 6000, "rollDeg": 5, "gForce": 1.5},
        {"speedKmh": 76, "rpm": 6100, "rollDeg": 6, "gForce": 1.4},
    ]

    for label, data in [("Normal", normal_points), ("Anomaly", anomaly_points)]:
        process = subprocess.Popen(['python', 'ml/online_detector.py'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate(input=json.dumps(data))
        print(f"{label} Result: {stdout.strip()}")

if __name__ == "__main__":
    test_anomaly()
