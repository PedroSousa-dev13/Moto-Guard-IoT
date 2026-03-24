"""
check_gpx_data.py — Verifica quantas viagens GPX reais vs sintéticas existem
"""

import os
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Contar viagens GPX
cur.execute("SELECT COUNT(*) FROM trips WHERE source = 'GPX_IMPORTED' AND status = 'COMPLETED'")
gpx_count = cur.fetchone()[0]

# Contar viagens SIMULATOR
cur.execute("SELECT COUNT(*) FROM trips WHERE source = 'SIMULATOR' AND status = 'COMPLETED'")
sim_count = cur.fetchone()[0]

# Ver detalhes das GPX (primeiras 5)
cur.execute("""
    SELECT t.id, t.started_at, t.distance_km, t.max_speed_kmh, t.avg_speed_kmh,
           (SELECT COUNT(*) FROM gpx_data g WHERE g.trip_id = t.id) as has_gpx_data
    FROM trips t
    WHERE t.source = 'GPX_IMPORTED' AND t.status = 'COMPLETED'
    ORDER BY t.started_at DESC
    LIMIT 5
""")
gpx_samples = cur.fetchall()

print("=" * 70)
print("ANÁLISE DE DADOS GPX")
print("=" * 70)
print(f"\nViagens GPX COMPLETED: {gpx_count}")
print(f"Viagens SIMULATOR COMPLETED: {sim_count}")

print(f"\nPrimeiras {len(gpx_samples)} viagens GPX:")
print("-" * 70)
for row in gpx_samples:
    trip_id, started, dist, max_spd, avg_spd, has_data = row
    print(f"ID: {trip_id[:8]}... | Data: {started} | Dist: {dist:.1f}km | Max: {max_spd:.0f}km/h | Avg: {avg_spd:.0f}km/h | GPX Data: {'✓' if has_data else '✗'}")

conn.close()
