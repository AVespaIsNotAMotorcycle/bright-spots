"""The 64 US national parks (Chiricahua became the 64th on 20 Oct 2026).

unit_code is the NPS four-letter code used in the NPS administrative boundary
file (field UNIT_CODE). Sequoia and Kings Canyon are managed together and share
the code SEKI, so the boundary file may have one polygon for both. If your
boundary file has separate codes for them, edit SEQUOIA_CODE / KINGS_CODE.

Territories: American Samoa (NPSA) and the US Virgin Islands (VIIS) are outside
Daymet's coverage, so their climate comes from NASA POWER instead.
"""

SEQUOIA_CODE = "SEKI"
KINGS_CODE = "SEKI"

# (park_id, display name, unit_code, state)
PARKS = [
    ("acad", "Acadia", "ACAD", "ME"),
    ("npsa", "American Samoa", "NPSA", "AS"),
    ("arch", "Arches", "ARCH", "UT"),
    ("badl", "Badlands", "BADL", "SD"),
    ("bibe", "Big Bend", "BIBE", "TX"),
    ("bisc", "Biscayne", "BISC", "FL"),
    ("blca", "Black Canyon of the Gunnison", "BLCA", "CO"),
    ("brca", "Bryce Canyon", "BRCA", "UT"),
    ("cany", "Canyonlands", "CANY", "UT"),
    ("care", "Capitol Reef", "CARE", "UT"),
    ("cave", "Carlsbad Caverns", "CAVE", "NM"),
    ("chis", "Channel Islands", "CHIS", "CA"),
    ("chir", "Chiricahua", "CHIR", "AZ"),
    ("cong", "Congaree", "CONG", "SC"),
    ("crla", "Crater Lake", "CRLA", "OR"),
    ("cuva", "Cuyahoga Valley", "CUVA", "OH"),
    ("deva", "Death Valley", "DEVA", "CA/NV"),
    ("dena", "Denali", "DENA", "AK"),
    ("drto", "Dry Tortugas", "DRTO", "FL"),
    ("ever", "Everglades", "EVER", "FL"),
    ("gaar", "Gates of the Arctic", "GAAR", "AK"),
    ("jeff", "Gateway Arch", "JEFF", "MO"),
    ("glac", "Glacier", "GLAC", "MT"),
    ("glba", "Glacier Bay", "GLBA", "AK"),
    ("grca", "Grand Canyon", "GRCA", "AZ"),
    ("grte", "Grand Teton", "GRTE", "WY"),
    ("grba", "Great Basin", "GRBA", "NV"),
    ("grsa", "Great Sand Dunes", "GRSA", "CO"),
    ("grsm", "Great Smoky Mountains", "GRSM", "TN/NC"),
    ("gumo", "Guadalupe Mountains", "GUMO", "TX"),
    ("hale", "Haleakala", "HALE", "HI"),
    ("havo", "Hawaii Volcanoes", "HAVO", "HI"),
    ("hosp", "Hot Springs", "HOSP", "AR"),
    ("indu", "Indiana Dunes", "INDU", "IN"),
    ("isro", "Isle Royale", "ISRO", "MI"),
    ("jotr", "Joshua Tree", "JOTR", "CA"),
    ("katm", "Katmai", "KATM", "AK"),
    ("kefj", "Kenai Fjords", "KEFJ", "AK"),
    ("kica", "Kings Canyon", KINGS_CODE, "CA"),
    ("kova", "Kobuk Valley", "KOVA", "AK"),
    ("lacl", "Lake Clark", "LACL", "AK"),
    ("lavo", "Lassen Volcanic", "LAVO", "CA"),
    ("maca", "Mammoth Cave", "MACA", "KY"),
    ("meve", "Mesa Verde", "MEVE", "CO"),
    ("mora", "Mount Rainier", "MORA", "WA"),
    ("neri", "New River Gorge", "NERI", "WV"),
    ("noca", "North Cascades", "NOCA", "WA"),
    ("olym", "Olympic", "OLYM", "WA"),
    ("pefo", "Petrified Forest", "PEFO", "AZ"),
    ("pinn", "Pinnacles", "PINN", "CA"),
    ("redw", "Redwood", "REDW", "CA"),
    ("romo", "Rocky Mountain", "ROMO", "CO"),
    ("sagu", "Saguaro", "SAGU", "AZ"),
    ("sequ", "Sequoia", SEQUOIA_CODE, "CA"),
    ("shen", "Shenandoah", "SHEN", "VA"),
    ("thro", "Theodore Roosevelt", "THRO", "ND"),
    ("viis", "Virgin Islands", "VIIS", "VI"),
    ("voya", "Voyageurs", "VOYA", "MN"),
    ("whsa", "White Sands", "WHSA", "NM"),
    ("wica", "Wind Cave", "WICA", "SD"),
    ("wrst", "Wrangell-St. Elias", "WRST", "AK"),
    ("yell", "Yellowstone", "YELL", "WY/MT/ID"),
    ("yose", "Yosemite", "YOSE", "CA"),
    ("zion", "Zion", "ZION", "UT"),
]

assert len(PARKS) == 64, len(PARKS)
assert len({p[0] for p in PARKS}) == 64

UNIT_CODES = sorted({p[2] for p in PARKS})

# Outside Daymet coverage (continental North America, Hawaii, Puerto Rico).
POWER_ONLY = {"NPSA", "VIIS"}
