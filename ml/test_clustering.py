import json
import subprocess

def test_clustering():
    # Mock data for 5 trips
    trips = [
        # Trip 1: Aggressive
        {
            "trip": {"id": "t1", "maxSpeedKmh": 180, "maxRollDeg": 45, "maxGForce": 1.8, "distanceKm": 50, "avgSpeedKmh": 120},
            "events": [{"type": "HARD_BRAKING", "severity": "WARNING"}, {"type": "RAPID_ACCELERATION", "severity": "INFO"}],
            "profile": {"maxSpeedKmh": 200, "typicalMaxRollDeg": 40}
        },
        # Trip 2: Aggressive
        {
            "trip": {"id": "t2", "maxSpeedKmh": 190, "maxRollDeg": 42, "maxGForce": 2.0, "distanceKm": 30, "avgSpeedKmh": 110},
            "events": [{"type": "HARD_BRAKING", "severity": "CRITICAL"}],
            "profile": {"maxSpeedKmh": 200, "typicalMaxRollDeg": 40}
        },
        # Trip 3: Defensive
        {
            "trip": {"id": "t3", "maxSpeedKmh": 90, "maxRollDeg": 20, "maxGForce": 0.8, "distanceKm": 100, "avgSpeedKmh": 70},
            "events": [],
            "profile": {"maxSpeedKmh": 200, "typicalMaxRollDeg": 40}
        },
        # Trip 4: Economy
        {
            "trip": {"id": "t4", "maxSpeedKmh": 80, "maxRollDeg": 15, "maxGForce": 0.5, "distanceKm": 200, "avgSpeedKmh": 60},
            "events": [],
            "profile": {"maxSpeedKmh": 200, "typicalMaxRollDeg": 40}
        },
        # Trip 5: Defensive
        {
            "trip": {"id": "t5", "maxSpeedKmh": 100, "maxRollDeg": 25, "maxGForce": 1.1, "distanceKm": 80, "avgSpeedKmh": 80},
            "events": [{"type": "INFO", "severity": "INFO"}],
            "profile": {"maxSpeedKmh": 200, "typicalMaxRollDeg": 40}
        }
    ]

    process = subprocess.Popen(['python', 'ml/clustering.py'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = process.communicate(input=json.dumps(trips))

    if stderr:
        print("Error:", stderr)
    else:
        results = json.loads(stdout)
        print("Clustering Results:")
        for r in results:
            print(f"Trip {r['tripId']}: {r['drivingStyle']} (Cluster {r['clusterId']})")

if __name__ == "__main__":
    test_clustering()
