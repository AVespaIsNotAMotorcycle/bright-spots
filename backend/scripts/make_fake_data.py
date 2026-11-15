"""Make fake input files with two planted trends (Zion warming, Glacier cooling)
so you can test steps 3+ before the real data arrives. Run from an empty folder:
    python path/to/make_fake_data.py && python path/to/step3_trends.py
NEVER mix these files with real data."""
import sys; sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import numpy as np, pandas as pd
from pathlib import Path
from parks import PARKS, POWER_ONLY
rng = np.random.default_rng(1)
out = Path("out"); (out/"daymet").mkdir(parents=True, exist_ok=True)
pd.DataFrame([{"park_id":p,"name":n,"unit_code":c,"state":s,"area_km2":100,"lat":40,"lon":-110,
  "climate_source":"x"} for p,n,c,s in PARKS]).to_csv(out/"parks.csv", index=False)
codes = sorted({c for _,_,c,_ in PARKS} - POWER_ONLY)
trend = {"ZION": 0.06, "GLAC": -0.04}  # °C per year, all months
def rows(code, y, src):
    r=[]
    for m in range(1,13):
        base = 15+10*np.sin((m-4)/12*2*np.pi) + trend.get(code,0)*(y-1980)
        tmax = base + rng.normal(0,1.2)
        r.append(dict(year=y,month=m,tmax_c=tmax,tmin_c=tmax-14,tmean_c=tmax-7,
          hot90_days=max(0,round((tmax-28)*3)),hot100_days=0,prcp_mm=max(0,rng.normal(50,20)),n_days=30 if m!=2 else 28))
    return r
for y in range(1980,2026):
    pd.DataFrame([dict(UNIT_CODE=c,**r) for c in codes for r in rows(c,y,"d")]).to_csv(out/"daymet"/f"daymet_parks_{y}.csv",index=False)
pw=[]
for p,n,c,s in PARKS:
    for y in range(1981,2027):
        for r in rows(c,y,"p"):
            if y==2026 and r["month"]>10: continue
            pw.append(dict(park_id=p,**r,rh_pct=60))
pd.DataFrame(pw).to_csv(out/"power_monthly.csv",index=False)
