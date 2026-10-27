"""Generate a realistic Singaporean sales dataset into examples/sales.xlsx.

Produces 500 rows with valid, DOB-based NRICs that are consistent with the
``Date Of Birth`` and ``Gender`` columns, Singaporean addresses, and Singapore
mobile phone numbers. Column order and the categorical vocabularies (Title,
Education) match the original file so the SDV evaluation stays comparable.

Usage:
    python examples/generate_sales.py
"""

from __future__ import annotations

import random
from datetime import date
from pathlib import Path

import pandas as pd

SEED = 42
N_ROWS = 500
# Reference date used to derive ``Age`` from a date of birth.
REFERENCE_DATE = date(2026, 10, 27)

# Keep birth years within 1969-2005 so every NRIC uses the DOB-based
# (post-1968) format and the ages land in a realistic 21-57 band.
MIN_AGE = 21
MAX_AGE = 57

COLUMNS = [
    "NRIC",
    "Name",
    "Age",
    "Date Of Birth",
    "Gender",
    "Address",
    "Phone Number",
    "Education",
    "Sales",
    "Title",
    "Remarks",
]

# --- Titles (same four values as the original file) -------------------------
TITLES = ["Jr Sales Assistant", "Sales Assistant", "Sales Associate", "Sales Director"]
TITLE_WEIGHTS = [0.30, 0.30, 0.25, 0.15]
# (min_age, max_age) target band per title -> higher titles skew older.
TITLE_AGE_BAND = {
    "Jr Sales Assistant": (21, 32),
    "Sales Assistant": (24, 40),
    "Sales Associate": (28, 48),
    "Sales Director": (35, 56),
}
# Sales (SGD) band per title -> higher titles earn more.
TITLE_SALES_BAND = {
    "Jr Sales Assistant": (4_000, 14_000),
    "Sales Assistant": (10_000, 24_000),
    "Sales Associate": (18_000, 38_000),
    "Sales Director": (32_000, 50_000),
}
# Education (same four values as the original file) distribution per title.
TITLE_EDU_DIST = {
    "Jr Sales Assistant": {"Diploma": 0.60, "Bachelors": 0.40},
    "Sales Assistant": {"Diploma": 0.35, "Bachelors": 0.60, "Masters": 0.05},
    "Sales Associate": {"Diploma": 0.10, "Bachelors": 0.55, "Masters": 0.35},
    "Sales Director": {"Bachelors": 0.30, "Masters": 0.60, "Doctorate": 0.10},
}

# --- Names ------------------------------------------------------------------
ETHNICITY_WEIGHTS = [0.55, 0.25, 0.15, 0.05]  # Chinese, Malay, Indian, Other
CHINESE_SURNAMES = [
    "Tan", "Lee", "Ng", "Goh", "Lim", "Wong", "Teo", "Chua", "Low", "Yeo",
    "Foo", "Ho", "Ooi", "Sim", "Koh", "Chan", "Liew", "Seow", "Kwa", "Wee",
]
CHINESE_GIVEN = {
    "M": ["Wei Ming", "Rui Yang", "Jia Hao", "Hui", "Zhi Jie", "Kai Wen", "Jun Jie", "Li Hao", "Ming Xin", "Zheng"],
    "F": ["Ji Ya", "Wei Ling", "Mei Ling", "Xin Yi", "Jia Xin", "Siew Yin", "Hui Wen", "Li Na", "Wen Jing", "Xiao Yun"],
}
MALAY_SURNAMES = [
    "Rahman", "Ibrahim", "Abdullah", "Ishak", "Yusof", "Osman", "Karim",
    "Hassan", "Amin", "Halim",
]
MALAY_GIVEN = {
    "M": ["Ahmad", "Muhammad", "Hafiz", "Aiman", "Zulkifli", "Rizal", "Farid", "Aqil"],
    "F": ["Nurul", "Siti", "Aisyah", "Aminah", "Farah", "Zulaikha", "Hana", "Nadia"],
}
INDIAN_SURNAMES = [
    "Kumar", "Nair", "Reddy", "Sharma", "Menon", "Pillai", "Subramaniam",
    "Perera", "Naidu",
]
INDIAN_GIVEN = {
    "M": ["Suresh", "Rajesh", "Vikram", "Arjun", "Karthik", "Prakash", "Dev", "Manoj"],
    "F": ["Priya", "Lakshmi", "Meera", "Deepa", "Anitha", "Kavitha", "Divya", "Sowmya"],
}
OTHER_SURNAMES = ["Ong", "Fernandez", "de Souza", "Pereira", "Smith", "Jones", "Tan"]
OTHER_GIVEN = {
    "M": ["Javier", "Marcus", "Daniel", "Ryan", "Ethan"],
    "F": ["Margaret", "Emily", "Sophia", "Claire", "Isabelle"],
}

# --- Addresses --------------------------------------------------------------
TOWNS = [
    "Punggol", "Sengkang", "Simei", "Tampines", "Bedok", "Jurong", "Woodlands",
    "Yishun", "Ang Mo Kio", "Toa Payoh", "Queenstown", "Novena", "East Coast",
    "Bishan", "Yew Chee", "Hougang", "Serangoon", "Bukit Panjang", "Clementi",
    "Pasir Ris", "Kallang", "Orchard", "River Valley", "Tanglin",
]
HDB_SUFFIXES = ["St", "Ave", "Rd", "Ln", "Way", "Cres", "Dr", "Close", "Loop"]
PRIVATE_ROADS = [
    "Mandarin Drive", "Cluny Road", "Telok Blangah Road", "Dover Road",
    "Holland Road", "Bukit Timah Road", "Cairnhills Road", "Mountbatten Road",
    "Alexandra Road", "Frere Hill", "Sutton Drive", "Loyang Avenue",
]

# --- Remarks ---------------------------------------------------------------
REMARKS_POOL = [
    "Key account - enterprise client.",
    "On annual leave until November.",
    "Top performer 2025.",
    "New hire, onboarding in progress.",
    "Transferred from the APAC team.",
    "Handles the northern region.",
    "Pending contract renewal.",
    "Referred by an existing client.",
]


def nric_checksum(prefix: str, serial: str) -> str:
    """Compute the NRIC/NIS check digit.

    Canonical algorithm: weights [2,7,6,5,4,3,2,1] over the prefix + 7-digit
    serial; letters A-I map to 10-18, J-Z map to 10-26; sum mod 11 maps to the
    check letter.
    """
    weights = [2, 7, 6, 5, 4, 3, 2, 1]

    def char_value(c: str) -> int:
        if c.isdigit():
            return int(c)
        pos = ord(c.upper()) - ord("A") + 1  # A=1..Z=26
        return pos + 9 if pos <= 9 else pos  # A-I -> 10-18, J-Z -> 10-26

    total = sum(char_value(c) * w for c, w in zip([prefix] + list(serial), weights))
    check = {0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F",
             6: "G", 7: "H", 8: "J", 9: "K", 10: "R"}
    return check[total % 11]


def make_nric(dob: date, gender: str) -> str:
    """Build a DOB-based NRIC whose serial encodes the DOB and the gender bit."""
    yy = f"{dob.year % 100:02d}"
    mm = f"{dob.month:02d}"
    dd = f"{dob.day:02d}"
    prefix = "S" if dob.year < 2000 else "T"
    # 7th serial digit encodes gender: odd = M, even = F.
    gender_digit = random.choice([1, 3, 5, 7, 9] if gender == "M" else [0, 2, 4, 6, 8])
    serial = yy + mm + dd + str(gender_digit)
    return prefix + serial + nric_checksum(prefix, serial)


def age_from_dob(dob: date) -> int:
    age = REFERENCE_DATE.year - dob.year
    if (REFERENCE_DATE.month, REFERENCE_DATE.day) < (dob.month, dob.day):
        age -= 1
    return age


def weighted_choice(items: list, weights: list) -> str:
    return random.choices(items, weights=weights, k=1)[0]


def pick_name(gender: str) -> str:
    ethnicity = weighted_choice(["Chinese", "Malay", "Indian", "Other"], ETHNICITY_WEIGHTS)
    if ethnicity == "Chinese":
        surname = random.choice(CHINESE_SURNAMES)
        given = random.choice(CHINESE_GIVEN[gender])
    elif ethnicity == "Malay":
        surname = random.choice(MALAY_SURNAMES)
        given = random.choice(MALAY_GIVEN[gender])
    elif ethnicity == "Indian":
        surname = random.choice(INDIAN_SURNAMES)
        given = random.choice(INDIAN_GIVEN[gender])
    else:
        surname = random.choice(OTHER_SURNAMES)
        given = random.choice(OTHER_GIVEN[gender])
    return f"{given} {surname}"


def pick_address() -> str:
    if random.random() < 0.70:  # HDB block address
        block = random.randint(1, 120)
        if random.random() < 0.30:
            block = f"{block}{random.choice('ABCDEFGH')}"
        town = random.choice(TOWNS)
        suffix = random.choice(HDB_SUFFIXES)
        number = random.randint(1, 40)
        return f"Blk {block} {town} {suffix} {number}"
    # Private address
    if random.random() < 0.5:
        return f"{random.randint(1, 88)} {random.choice(PRIVATE_ROADS)}"
    town = random.choice(TOWNS)
    return f"{random.randint(1, 99)} {town} {random.choice(HDB_SUFFIXES)}"


def pick_phone() -> int:
    return random.choice([8, 9]) * 10_000_000 + random.randint(0, 9_999_999)


def pick_remarks() -> str | None:
    if random.random() < 0.70:
        return None
    return random.choice(REMARKS_POOL)


def generate_row(rng: random.Random) -> dict:
    title = weighted_choice(TITLES, TITLE_WEIGHTS)
    gender = rng.choices(["M", "F"], weights=[0.52, 0.48], k=1)[0]

    # Age within the title's band, clamped to the global realistic range.
    lo, hi = TITLE_AGE_BAND[title]
    lo, hi = max(MIN_AGE, lo), min(MAX_AGE, hi)
    age = rng.randint(lo, hi)
    birth_year = REFERENCE_DATE.year - age
    dob = date(birth_year, rng.randint(1, 12), rng.randint(1, 28))

    education = weighted_choice(
        list(TITLE_EDU_DIST[title].keys()),
        list(TITLE_EDU_DIST[title].values()),
    )
    sales_lo, sales_hi = TITLE_SALES_BAND[title]
    sales = int(round(rng.uniform(sales_lo, sales_hi) / 100.0) * 100)

    return {
        "NRIC": make_nric(dob, gender),
        "Name": pick_name(gender),
        "Age": age_from_dob(dob),
        "Date Of Birth": dob,
        "Gender": gender,
        "Address": pick_address(),
        "Phone Number": pick_phone(),
        "Education": education,
        "Sales": sales,
        "Title": title,
        "Remarks": pick_remarks(),
    }


def main() -> None:
    random.seed(SEED)
    rows = [generate_row(random) for _ in range(N_ROWS)]
    df = pd.DataFrame(rows, columns=COLUMNS)
    out = Path(__file__).resolve().parent / "sales.xlsx"
    df.to_excel(out, index=False)
    print(f"Wrote {len(df)} rows to {out}")


if __name__ == "__main__":
    main()
