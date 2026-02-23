"""
Generate realistic synthetic EDI 837P and 835 test data at configurable volume.

Usage:
    python generate_test_edi.py [--claims N] [--days D] [--outdir DIR]

Defaults: 150 claims over 5 business days, written to test_data/
"""

import argparse
import json
import os
import random
import string
from datetime import datetime, timedelta

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data pools
# ---------------------------------------------------------------------------

PROVIDERS = [
    {"npi": "1234567890", "org": "NASHVILLE PRIMARY CARE PLLC", "addr": "100 MAIN STREET STE 200", "city": "NASHVILLE", "state": "TN", "zip": "37203", "ein": "621234567", "taxonomy": "207Q00000X"},
    {"npi": "2345678901", "org": "MIDTOWN FAMILY MEDICINE", "addr": "2100 CHURCH ST STE 300", "city": "NASHVILLE", "state": "TN", "zip": "37203", "ein": "621234568", "taxonomy": "207Q00000X"},
    {"npi": "3456789012", "org": "CUMBERLAND ORTHOPEDIC ASSOC", "addr": "4500 HARDING PIKE STE 100", "city": "NASHVILLE", "state": "TN", "zip": "37205", "ein": "621234569", "taxonomy": "207X00000X"},
]

RENDERING = [
    {"npi": "1122334455", "last": "THOMPSON", "first": "RACHEL", "mid": "L", "taxonomy": "207Q00000X"},
    {"npi": "9876543210", "last": "PATEL", "first": "ANISHA", "mid": "K", "taxonomy": "207RE0101X"},
    {"npi": "5566778899", "last": "GARCIA", "first": "MARCUS", "mid": "D", "taxonomy": "207Q00000X"},
    {"npi": "6677889900", "last": "KIM", "first": "JENNY", "mid": "S", "taxonomy": "207RC0000X"},
    {"npi": "7788990011", "last": "ABRAMS", "first": "DANIEL", "mid": "T", "taxonomy": "207X00000X"},
]

PAYERS = [
    {"id": "62308", "name": "BCBS OF TENNESSEE", "addr": "PO BOX 190095", "city": "NASHVILLE", "state": "TN", "zip": "37219", "filing": "BL"},
    {"id": "12001", "name": "PALMETTO GBA", "addr": "PO BOX 100190", "city": "COLUMBIA", "state": "SC", "zip": "29202", "filing": "MC"},
    {"id": "87726", "name": "UNITED HEALTHCARE", "addr": "PO BOX 740800", "city": "ATLANTA", "state": "GA", "zip": "30374", "filing": "CI"},
    {"id": "99726", "name": "TRICARE", "addr": "PO BOX 7872", "city": "MADISON", "state": "WI", "zip": "53707", "filing": "CH"},
    {"id": "60054", "name": "AETNA", "addr": "PO BOX 981106", "city": "EL PASO", "state": "TX", "zip": "79998", "filing": "CI"},
    {"id": "62308C", "name": "CIGNA HEALTHCARE", "addr": "PO BOX 188061", "city": "CHATTANOOGA", "state": "TN", "zip": "37422", "filing": "CI"},
    {"id": "61101", "name": "HUMANA", "addr": "PO BOX 14601", "city": "LEXINGTON", "state": "KY", "zip": "40512", "filing": "HM"},
    {"id": "36273", "name": "AMBETTER TN", "addr": "PO BOX 5010", "city": "FARMINGTON", "state": "MO", "zip": "63640", "filing": "HM"},
]

PAYER_WEIGHTS = [25, 15, 18, 5, 12, 10, 10, 5]

LAST_NAMES = [
    "JOHNSON", "WILLIAMS", "CHEN", "RAMIREZ", "OKAFOR", "MARTINEZ", "BROOKS",
    "FOSTER", "NGUYEN", "PATEL", "SMITH", "JONES", "BROWN", "DAVIS", "WILSON",
    "MOORE", "TAYLOR", "ANDERSON", "THOMAS", "JACKSON", "WHITE", "HARRIS",
    "MARTIN", "GARCIA", "ROBINSON", "CLARK", "LEWIS", "LEE", "WALKER", "HALL",
    "ALLEN", "YOUNG", "KING", "WRIGHT", "SCOTT", "GREEN", "BAKER", "ADAMS",
    "NELSON", "HILL", "CAMPBELL", "MITCHELL", "ROBERTS", "CARTER", "PHILLIPS",
    "EVANS", "TURNER", "TORRES", "PARKER", "COLLINS", "EDWARDS", "STEWART",
    "DIAZ", "MORALES", "REYES", "CRUZ", "SULLIVAN", "MURPHY", "BAILEY", "PRICE",
]

FIRST_NAMES_M = [
    "MICHAEL", "JAMES", "DAVID", "CARLOS", "THANH", "ROBERT", "WILLIAM",
    "RICHARD", "JOSEPH", "THOMAS", "CHRISTOPHER", "CHARLES", "DANIEL",
    "MATTHEW", "ANTHONY", "MARK", "DONALD", "STEVEN", "PAUL", "ANDREW",
    "KEVIN", "BRIAN", "GEORGE", "TIMOTHY", "JASON", "TYLER", "MARCUS",
    "ETHAN", "NOAH", "LOGAN",
]

FIRST_NAMES_F = [
    "DOROTHY", "NGOZI", "SOFIA", "BETTY", "SARAH", "JENNIFER", "JESSICA",
    "LINDA", "ELIZABETH", "BARBARA", "SUSAN", "MARGARET", "LISA", "NANCY",
    "KAREN", "MARIA", "SANDRA", "ASHLEY", "EMILY", "DONNA", "RUTH", "ANNA",
    "GRACE", "OLIVIA", "EMMA", "CHARLOTTE", "AMELIA", "HARPER", "MIA", "CHLOE",
]

MIDDLE_INITIALS = list("ABCDEFGHJKLMNPRSTV")

VISIT_TYPES = [
    {
        "name": "office_visit_simple",
        "weight": 30,
        "cpts": [("99213", 125, 165)],
        "dx_pool": [
            ["J069", "R059"], ["J029", "R509"], ["J0190", "R059"],
            ["R1010", "K219"], ["M5430", "M545"],
            ["R51", "G439"], ["N390", "R301"], ["L709", "L010"],
        ],
    },
    {
        "name": "office_visit_moderate",
        "weight": 25,
        "cpts": [("99214", 175, 225)],
        "dx_pool": [
            ["J301", "J3281", "H9390"], ["M545", "M793"],
            ["N920", "R310", "N281"], ["E119", "E785", "I10"],
            ["G4700", "F411"], ["K5900", "R197", "K219"],
            ["M1711", "M1712", "M25561"], ["J449", "J9601", "R0602"],
        ],
    },
    {
        "name": "office_visit_complex",
        "weight": 10,
        "cpts": [("99215", 250, 325)],
        "dx_pool": [
            ["E1165", "I10", "E785", "N183"],
            ["I2510", "I10", "E119", "E785", "Z794"],
            ["C50911", "Z8531", "Z80811"],
            ["M5416", "M5130", "G8929", "M4312"],
            ["G309", "F0390", "R4181", "G4700"],
        ],
    },
    {
        "name": "wellness_preventive",
        "weight": 12,
        "cpts": [("99395", 185, 225), ("99396", 210, 265)],
        "dx_pool": [
            ["Z0000", "Z1231"], ["Z0001", "Z1231", "Z1211"],
            ["Z0000", "Z23", "Z1231"], ["Z0001", "Z8049"],
        ],
    },
    {
        "name": "procedure_injection",
        "weight": 8,
        "cpts": [("99214", 175, 225), ("20610", 100, 150)],
        "dx_pool": [
            ["M545", "M793"], ["M1711", "M25561"],
            ["M7541", "M7551"], ["M5416", "M5130"],
        ],
    },
    {
        "name": "urgent_visit",
        "weight": 5,
        "cpts": [("99214", 175, 225), ("73610", 150, 200)],
        "dx_pool": [
            ["S93401A", "M79671", "M25571"],
            ["S6290XA", "M79641"], ["S83501A", "M2361"],
            ["S52501A", "M79631"],
        ],
    },
    {
        "name": "chronic_care_mgmt",
        "weight": 5,
        "cpts": [("99490", 65, 85)],
        "dx_pool": [
            ["E119", "I10", "E785"], ["E1165", "N183", "I10"],
            ["I5032", "I10", "E119"],
        ],
    },
    {
        "name": "behavioral_health",
        "weight": 5,
        "cpts": [("99214", 175, 225), ("96127", 25, 35), ("90834", 85, 115)],
        "dx_pool": [
            ["F411", "F321", "G4700"], ["F329", "F419"],
            ["F909", "F329", "F411"], ["F1020", "F329"],
        ],
    },
]

ADD_ON_POOL = [
    ("87880", 35, 55), ("99000", 12, 20), ("36415", 25, 35),
    ("85025", 35, 55), ("80053", 100, 140), ("83036", 45, 65),
    ("80061", 70, 95), ("80048", 60, 85), ("81001", 25, 40),
    ("93000", 120, 165), ("94010", 35, 55), ("94060", 45, 70),
    ("96372", 180, 230), ("81003", 20, 30), ("80069", 65, 90),
    ("85027", 30, 50), ("87070", 40, 65), ("87081", 35, 55),
    ("71046", 130, 180), ("71101", 140, 190),
]

STREETS = [
    "ELM AVE", "OAK RIDGE DR", "WEST END AVE", "FORT CAMPBELL BLVD",
    "CHARLOTTE PIKE", "BROADWAY", "CHARLOTTE AVE", "NOLENSVILLE PIKE",
    "12TH AVE S", "GALLATIN PIKE", "DICKERSON PIKE", "MURFREESBORO PIKE",
    "LEBANON PIKE", "8TH AVE S", "THOMPSON LN", "BELL RD", "HARDING PLACE",
    "BRILEY PKWY", "HERMITAGE AVE", "SHELBY AVE", "WOODLAND ST",
    "ROSA PARKS BLVD", "BUCHANAN ST", "FATHERLAND ST", "5TH AVE N",
]

CITIES_TN = [
    ("NASHVILLE", "37203"), ("NASHVILLE", "37211"), ("NASHVILLE", "37209"),
    ("NASHVILLE", "37205"), ("MURFREESBORO", "37130"), ("CLARKSVILLE", "37042"),
    ("FRANKLIN", "37064"), ("HENDERSONVILLE", "37075"), ("GALLATIN", "37066"),
    ("SMYRNA", "37167"), ("LEBANON", "37087"), ("BRENTWOOD", "37027"),
    ("MOUNT JULIET", "37122"), ("SPRING HILL", "37174"),
]

APT_SUFFIXES = ["", "", "", "", " APT 4B", " APT 14C", " APT 7", " STE 200", " UNIT 3A", " APT 22"]

DENIAL_SCENARIOS = [
    {"code": "197", "desc": "no_precert", "rate": 0.05},
    {"code": "16", "desc": "lack_info", "rate": 0.03},
    {"code": "18", "desc": "duplicate", "rate": 0.02},
    {"code": "29", "desc": "timely_filing", "rate": 0.01},
    {"code": "50", "desc": "non_covered", "rate": 0.02},
]

PARTIAL_DENIAL_RATE = 0.08

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rand_member_id(payer):
    prefix_map = {
        "62308": "XYK", "12001": "1EG", "87726": "UHC",
        "99726": "DOD", "60054": "AET", "62308C": "CGN",
        "61101": "HUM", "36273": "AMB",
    }
    prefix = prefix_map.get(payer["id"], "MBR")
    return prefix + "".join(random.choices(string.digits, k=9))


def rand_group():
    return "GRP" + "".join(random.choices(string.digits, k=6))


def rand_dob(min_age=18, max_age=88):
    days_back = random.randint(min_age * 365, max_age * 365)
    return (datetime(2025, 1, 15) - timedelta(days=days_back)).strftime("%Y%m%d")


def rand_gender():
    return random.choice(["M", "F"])


def fmt_date(dt):
    return dt.strftime("%Y%m%d")


def fmt_time(dt):
    return dt.strftime("%H%M")


def rand_charge(lo, hi):
    return round(random.uniform(lo, hi), 0)


def pad_isa(val, length):
    return (val + " " * length)[:length]


# ---------------------------------------------------------------------------
# 837P generator
# ---------------------------------------------------------------------------

def generate_claims(num_claims, service_dates):
    """Generate claim dicts for 837P files."""
    claims = []
    for i in range(num_claims):
        svc_date = random.choice(service_dates)
        visit = random.choices(VISIT_TYPES, weights=[v["weight"] for v in VISIT_TYPES])[0]
        payer = random.choices(PAYERS, weights=PAYER_WEIGHTS)[0]
        provider_org = random.choice(PROVIDERS)
        renderer = random.choice(RENDERING)
        gender = rand_gender()
        first = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        last = random.choice(LAST_NAMES)
        mid = random.choice(MIDDLE_INITIALS)
        dob = rand_dob()
        city, zipcode = random.choice(CITIES_TN)
        street_num = random.randint(100, 9800)
        street = random.choice(STREETS)
        apt = random.choice(APT_SUFFIXES)
        addr = f"{street_num} {street}{apt}"
        member_id = rand_member_id(payer)
        group_num = rand_group()
        claim_id = f"{first[0]}{mid}{last[0]}{fmt_date(svc_date)[-4:]}{i+1:04d}"

        lines = []
        cpt_choices = visit["cpts"]
        if len(cpt_choices) > 1 and random.random() < 0.3:
            cpt_choices = [random.choice(cpt_choices)]

        for cpt, lo, hi in cpt_choices:
            charge = rand_charge(lo, hi)
            units = 1
            modifier = ""
            if cpt == "99213" and len(cpt_choices) > 1:
                modifier = "25"
            lines.append({"cpt": cpt, "charge": charge, "units": units, "modifier": modifier})

        num_addons = random.choices([0, 1, 2, 3, 4], weights=[25, 30, 25, 15, 5])[0]
        used_cpts = {l["cpt"] for l in lines}
        for _ in range(num_addons):
            addon = random.choice(ADD_ON_POOL)
            if addon[0] not in used_cpts:
                used_cpts.add(addon[0])
                units = random.choices([1, 2], weights=[85, 15])[0]
                lines.append({"cpt": addon[0], "charge": rand_charge(addon[1], addon[2]), "units": units, "modifier": ""})

        dx_set = random.choice(visit["dx_pool"])

        needs_auth = random.random() < 0.12
        auth_num = f"AUTH2025{random.randint(10000,99999)}" if needs_auth else None

        full_denial = False
        for scenario in DENIAL_SCENARIOS:
            if random.random() < scenario["rate"]:
                full_denial = True
                denial_code = scenario["code"]
                break

        partial = False
        if not full_denial and random.random() < PARTIAL_DENIAL_RATE:
            partial = True

        total_charge = sum(l["charge"] * l["units"] for l in lines)

        onset_date = None
        init_treatment = None
        if visit["name"] in ("urgent_visit", "procedure_injection") and random.random() < 0.6:
            onset_date = svc_date - timedelta(days=random.randint(1, 60))
        if visit["name"] == "chronic_care_mgmt" and random.random() < 0.5:
            init_treatment = svc_date - timedelta(days=random.randint(30, 365))

        claims.append({
            "claim_id": claim_id,
            "svc_date": svc_date,
            "lines": lines,
            "dx": dx_set,
            "total_charge": total_charge,
            "patient": {"last": last, "first": first, "mid": mid, "gender": gender, "dob": dob,
                        "addr": addr, "city": city, "state": "TN", "zip": zipcode},
            "payer": payer,
            "member_id": member_id,
            "group_num": group_num,
            "provider_org": provider_org,
            "renderer": renderer,
            "auth_num": auth_num,
            "full_denial": full_denial,
            "denial_code": denial_code if full_denial else None,
            "partial": partial,
            "onset_date": onset_date,
            "init_treatment": init_treatment,
        })

    return claims


def build_837p_stream(claims, isa_num, gs_num, isa_date):
    """Build raw EDI 837P stream from claim dicts."""
    segs = []

    segs.append(
        f"ISA*00*{pad_isa('', 10)}*00*{pad_isa('', 10)}"
        f"*ZZ*{pad_isa('CLRGHSE01', 15)}*ZZ*{pad_isa('1234567890', 15)}"
        f"*{fmt_date(isa_date)[2:]}*{fmt_time(isa_date)}*^*00501"
        f"*{isa_num:09d}*0*P*:"
    )
    segs.append(f"GS*HC*CLRGHSE01*1234567890*{fmt_date(isa_date)}*{fmt_time(isa_date)}*{gs_num}*X*005010X222A1")
    st_num = gs_num
    segs.append(f"ST*837*{st_num:04d}*005010X222A1")
    segs.append(f"BHT*0019*00*B{fmt_date(isa_date)}{st_num:03d}*{fmt_date(isa_date)}*{fmt_time(isa_date)}*CH")
    segs.append("NM1*41*2*AVAILITY LLC*****46*AV0001")

    first_payer = claims[0]["payer"]
    segs.append(f"NM1*40*2*{first_payer['name']}*****46*{first_payer['id']}")

    hl_count = 0

    orgs_seen = {}
    for claim in claims:
        org = claim["provider_org"]
        org_key = org["npi"]
        if org_key not in orgs_seen:
            hl_count += 1
            org_hl = hl_count
            orgs_seen[org_key] = org_hl
            segs.append(f"HL*{org_hl}**20*1")
            segs.append(f"PRV*BI*PXC*{org['taxonomy']}")
            segs.append(f"NM1*85*2*{org['org']}*****XX*{org['npi']}")
            segs.append(f"N3*{org['addr']}")
            segs.append(f"N4*{org['city']}*{org['state']}*{org['zip']}")
            segs.append(f"REF*EI*{org['ein']}")
        else:
            org_hl = orgs_seen[org_key]

        hl_count += 1
        sub_hl = hl_count
        p = claim["patient"]
        py = claim["payer"]
        segs.append(f"HL*{sub_hl}*{org_hl}*22*1")
        segs.append(f"SBR*P*18*{claim['group_num']}******{py['filing']}")
        segs.append(f"NM1*IL*1*{p['last']}*{p['first']}*{p['mid']}***MI*{claim['member_id']}")
        segs.append(f"N3*{p['addr']}")
        segs.append(f"N4*{p['city']}*{p['state']}*{p['zip']}")
        segs.append(f"DMG*D8*{p['dob']}*{p['gender']}")
        segs.append(f"NM1*PR*2*{py['name']}*****PI*{py['id']}")
        segs.append(f"N3*{py['addr']}")
        segs.append(f"N4*{py['city']}*{py['state']}*{py['zip']}")

        hl_count += 1
        pat_hl = hl_count
        segs.append(f"HL*{pat_hl}*{sub_hl}*23*0")
        segs.append("PAT*19")
        segs.append(f"NM1*QC*1*{p['last']}*{p['first']}*{p['mid']}")
        segs.append(f"N3*{p['addr']}")
        segs.append(f"N4*{p['city']}*{p['state']}*{p['zip']}")

        total = int(claim["total_charge"])
        segs.append(f"CLM*{claim['claim_id']}*{total}***11:B:1*Y*A*Y*Y")
        segs.append(f"DTP*472*D8*{fmt_date(claim['svc_date'])}")

        if claim.get("onset_date"):
            segs.append(f"DTP*439*D8*{fmt_date(claim['onset_date'])}")
        if claim.get("init_treatment"):
            segs.append(f"DTP*454*D8*{fmt_date(claim['init_treatment'])}")

        hi_parts = []
        for j, dx in enumerate(claim["dx"]):
            qual = "ABK" if j == 0 else "ABF"
            hi_parts.append(f"{qual}:{dx}")
        segs.append("HI*" + "*".join(hi_parts))

        segs.append(f"REF*D9*CLMREF{claim['claim_id']}")
        if claim.get("auth_num"):
            segs.append(f"REF*G1*{claim['auth_num']}")

        rend = claim["renderer"]
        segs.append(f"NM1*82*1*{rend['last']}*{rend['first']}*{rend['mid']}***XX*{rend['npi']}")
        segs.append(f"PRV*PE*PXC*{rend['taxonomy']}")

        for k, line in enumerate(claim["lines"], 1):
            segs.append(f"LX*{k}")
            proc = f"HC:{line['cpt']}"
            if line.get("modifier"):
                proc += f":{line['modifier']}"
            segs.append(f"SV1*{proc}*{int(line['charge'])}*UN*{line['units']}***1")
            segs.append(f"DTP*472*D8*{fmt_date(claim['svc_date'])}")

    seg_count = sum(1 for s in segs if s.startswith(("ST", "BHT", "NM1", "N3", "N4", "REF",
                                                       "HL", "SBR", "DMG", "PAT", "CLM", "DTP",
                                                       "HI", "PRV", "LX", "SV1")))
    segs.append(f"SE*{seg_count + 1}*{st_num:04d}")
    segs.append(f"GE*1*{gs_num}")
    segs.append(f"IEA*1*{isa_num:09d}")

    return "~".join(segs) + "~"


# ---------------------------------------------------------------------------
# 835 generator
# ---------------------------------------------------------------------------

def generate_remits(claims, payment_date):
    """Generate 835 payment stream for a list of claims."""
    remits = []
    for claim in claims:
        total = claim["total_charge"]

        if claim["full_denial"]:
            paid = 0.0
            patient_resp = 0.0
            status = "4"
        elif claim["partial"]:
            pct = random.uniform(0.45, 0.75)
            paid = round(total * pct, 2)
            patient_resp = round(total * random.uniform(0.05, 0.12), 2)
            status = random.choice(["2", "22"])
        else:
            allowed_pct = random.uniform(0.78, 0.92)
            allowed = round(total * allowed_pct, 2)
            patient_resp = round(allowed * random.uniform(0.05, 0.15), 2)
            paid = round(allowed - patient_resp, 2)
            status = "1"

        remits.append({
            "claim": claim,
            "paid": paid,
            "patient_resp": patient_resp,
            "status": status,
            "payment_date": payment_date,
        })
    return remits


def build_835_stream(remits, isa_num, gs_num, isa_date, payer_info):
    """Build raw EDI 835 stream."""
    segs = []

    segs.append(
        f"ISA*00*{pad_isa('', 10)}*00*{pad_isa('', 10)}"
        f"*ZZ*{pad_isa(payer_info['id'], 15)}*ZZ*{pad_isa('1234567890', 15)}"
        f"*{fmt_date(isa_date)[2:]}*{fmt_time(isa_date)}*^*00501"
        f"*{isa_num:09d}*0*P*:"
    )
    segs.append(f"GS*HP*{payer_info['id']}*1234567890*{fmt_date(isa_date)}*{fmt_time(isa_date)}*{gs_num}*X*005010X221A1")
    st_num = gs_num
    segs.append(f"ST*835*{st_num:04d}*005010X221A1")

    total_paid = sum(r["paid"] for r in remits)
    segs.append(
        f"BPR*I*{total_paid:.2f}*C*ACH*CCP*01*111000025*DA*9876543210"
        f"*1234567890**01*111000025*DA*1234567890*{fmt_date(isa_date)}"
    )
    eft_num = f"EFT{fmt_date(isa_date)}{gs_num:03d}"
    segs.append(f"TRN*1*{eft_num}*1234567890")
    segs.append(f"DTM*405*{fmt_date(isa_date)}")
    segs.append(f"N1*PR*{payer_info['name']}*PI*{payer_info['id']}")
    segs.append(f"N3*{payer_info['addr']}")
    segs.append(f"N4*{payer_info['city']}*{payer_info['state']}*{payer_info['zip']}")

    org = remits[0]["claim"]["provider_org"]
    segs.append(f"N1*PE*{org['org']}*XX*{org['npi']}")
    segs.append(f"N3*{org['addr']}")
    segs.append(f"N4*{org['city']}*{org['state']}*{org['zip']}")

    for r in remits:
        c = r["claim"]
        total = c["total_charge"]
        paid = r["paid"]
        pat_resp = r["patient_resp"]
        filing = c["payer"]["filing"]
        ctrl = f"{payer_info['id'][:4]}9{random.randint(1000000,9999999)}"

        segs.append(f"CLP*{c['claim_id']}*{r['status']}*{total:.0f}*{paid:.2f}*{pat_resp:.2f}*{filing}*{ctrl}")
        p = c["patient"]
        segs.append(f"NM1*QC*1*{p['last']}*{p['first']}*{p['mid']}")

        if c.get("renderer"):
            rend = c["renderer"]
            segs.append(f"NM1*82*1*{rend['last']}*{rend['first']}*{rend['mid']}***XX*{rend['npi']}")

        svc_str = fmt_date(c["svc_date"])
        pay_str = fmt_date(r["payment_date"])
        segs.append(f"DTM*232*{svc_str}")
        segs.append(f"DTM*233*{svc_str}")
        segs.append(f"DTM*573*{pay_str}")

        if c["full_denial"]:
            segs.append(f"CAS*CO*{c['denial_code']}*{total:.2f}")
        elif c["partial"]:
            writeoff = round(total - paid - pat_resp, 2)
            if writeoff > 0:
                segs.append(f"CAS*CO*45*{writeoff * 0.4:.2f}")
                segs.append(f"CAS*OA*23*{writeoff * 0.6:.2f}")
            if pat_resp > 0:
                segs.append(f"CAS*PR*2*{pat_resp:.2f}")
        else:
            contractual = round(total - paid - pat_resp, 2)
            if contractual > 0:
                segs.append(f"CAS*CO*45*{contractual:.2f}")
            if pat_resp > 0:
                copay = round(pat_resp * 0.6, 2)
                coins = round(pat_resp - copay, 2)
                segs.append(f"CAS*PR*1*{copay:.2f}*1*2*{coins:.2f}*1")

        for line in c["lines"]:
            proc = f"HC:{line['cpt']}"
            if line.get("modifier"):
                proc += f":{line['modifier']}"
            charged = line["charge"] * line["units"]
            if c["full_denial"]:
                line_paid = 0
            elif c["partial"]:
                line_paid = round(charged * (paid / total), 2)
            else:
                line_paid = round(charged * (paid / total), 2)
            segs.append(f"SVC*{proc}*{charged:.0f}*{line_paid:.2f}**{line['units']}")
            segs.append(f"DTM*472*{svc_str}")
            adj = round(charged - line_paid, 2)
            if adj > 0:
                if c["full_denial"]:
                    segs.append(f"CAS*CO*{c['denial_code']}*{adj:.2f}")
                else:
                    segs.append(f"CAS*CO*45*{adj:.2f}")

    seg_count = sum(1 for s in segs if not s.startswith(("ISA", "GS", "IEA", "GE")))
    segs.append(f"SE*{seg_count}*{st_num:04d}")
    segs.append(f"GE*1*{gs_num}")
    segs.append(f"IEA*1*{isa_num:09d}")

    return "~".join(segs) + "~"


# ---------------------------------------------------------------------------
# Ground-truth manifest (for ML training on synthetic corpus)
# ---------------------------------------------------------------------------

def build_truth_manifest(claims):
    """Create deterministic claim-level outcome labels for synthetic training."""
    manifest = []
    for claim in claims:
        if claim["full_denial"]:
            accepted_first_pass = 0
            outcome = "denied"
        elif claim["partial"]:
            accepted_first_pass = 1
            outcome = "partial"
        else:
            accepted_first_pass = 1
            outcome = "paid"

        manifest.append(
            {
                "claim_id": claim["claim_id"],
                "accepted_first_pass": accepted_first_pass,
                "outcome": outcome,
                "full_denial": bool(claim["full_denial"]),
                "partial": bool(claim["partial"]),
                "denial_code": claim.get("denial_code"),
                "payer_id": claim["payer"]["id"],
                "claim_filing_indicator_code": claim["payer"]["filing"],
                "service_date": fmt_date(claim["svc_date"]),
                "line_count": len(claim["lines"]),
                "diagnosis_count": len(claim["dx"]),
                "has_prior_auth": bool(claim.get("auth_num")),
            }
        )
    return manifest


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic EDI test data")
    parser.add_argument("--claims", type=int, default=150, help="Total claims to generate")
    parser.add_argument("--days", type=int, default=5, help="Business days to spread across")
    parser.add_argument("--outdir", default="test_data", help="Output directory")
    parser.add_argument(
        "--truth-file",
        default="synthetic_truth_manifest.json",
        help="File name for generated claim outcome manifest.",
    )
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    base_date = datetime(2025, 1, 13)
    service_dates = []
    d = base_date
    while len(service_dates) < args.days:
        if d.weekday() < 5:
            service_dates.append(d)
        d += timedelta(days=1)

    claims = generate_claims(args.claims, service_dates)
    claims.sort(key=lambda c: c["svc_date"])

    claims_per_batch = args.claims // 5
    remainder = args.claims % 5
    batches = []
    idx = 0
    for b in range(5):
        size = claims_per_batch + (1 if b < remainder else 0)
        batches.append(claims[idx:idx + size])
        idx += size

    isa_counter = 1
    gs_counter = 1
    for b_idx, batch in enumerate(batches, 1):
        if not batch:
            continue
        isa_date = batch[0]["svc_date"].replace(hour=random.randint(6, 18), minute=random.randint(0, 59))
        stream = build_837p_stream(batch, isa_counter, gs_counter, isa_date)
        fname = f"837P_batch_{b_idx:03d}.txt"
        with open(os.path.join(args.outdir, fname), "w", newline="") as f:
            f.write(stream)
        print(f"  {fname}: {len(batch)} claims")
        isa_counter += 1
        gs_counter += 1

    payment_lag = timedelta(days=random.randint(18, 28))
    payer_groups = {}
    for claim in claims:
        pid = claim["payer"]["id"]
        payer_groups.setdefault(pid, []).append(claim)

    remit_counter = 0
    for pid, payer_claims in payer_groups.items():
        payer_info = payer_claims[0]["payer"]
        payment_date = payer_claims[0]["svc_date"] + payment_lag
        remits = generate_remits(payer_claims, payment_date)
        stream = build_835_stream(remits, isa_counter, gs_counter, payment_date, payer_info)
        remit_counter += 1
        fname = f"835_remit_{remit_counter:03d}.txt"
        with open(os.path.join(args.outdir, fname), "w", newline="") as f:
            f.write(stream)
        print(f"  {fname}: {len(remits)} payments ({payer_info['name']})")
        isa_counter += 1
        gs_counter += 1

    print(f"\nGenerated {args.claims} claims across {len(batches)} 837P files")
    print(f"Generated {sum(len(v) for v in payer_groups.values())} remits across {remit_counter} 835 files")

    denied = sum(1 for c in claims if c["full_denial"])
    partial = sum(1 for c in claims if c["partial"])
    print(f"Outcomes: {args.claims - denied - partial} paid, {denied} denied, {partial} partial")

    manifest = build_truth_manifest(claims)
    manifest_path = os.path.join(args.outdir, args.truth_file)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote synthetic truth manifest: {manifest_path}")


if __name__ == "__main__":
    main()
