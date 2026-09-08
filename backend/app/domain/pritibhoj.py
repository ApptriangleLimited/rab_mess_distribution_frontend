PRITIBHOJ_MAIN_LABELS = (
    "অপারেশনস্ উইং",
    "ইন্টেলিজেন্স উইং",
    "যোগাযোগ উইং",
    "লিঃ এন্ড মিডিঃ উইং",
    "ট্রেনিং উইং",
    "তদন্ত উইং",
    "আরএন্ডডি সেল",
    "এয়ার উইং",
    "প্রশাসন ও অর্থ উইং",
    "সিএমএইচ ভর্তি রোগী",
)

PRITIBHOJ_ADMIN_LABELS = (
    "ডিজি দপ্তর",
    "এডিজি (অপস) দপ্তর",
    "এডিজি (এ্যাডমিন) দপ্তর",
    "পরিচালক (এ্যাডমিন) দপ্তর",
    "জেনারেল শাখা",
    "পার্সোনাল শাখা",
    "রেকর্ড শাখা",
    "সরবরাহ শাখা",
    "উন্নয়ন শাখা",
    "প্রকল্প শাখা",
    "ওয়ার্কশপ শাখা",
    "অর্থ শাখা",
    "প্রকিউরমেন্ট",
    "চিকিৎসা শাখা",
    "নিরাপত্তা শাখা",
    "সদর দপ্তর শাখা",
)

def _as_int(value) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def finalize_row(row: dict | None, wing: str) -> dict:
    src = row if isinstance(row, dict) else {}
    dad = _as_int(src.get("dad"))
    azad_hall = _as_int(src.get("azadHall"))
    others = _as_int(src.get("others"))
    civilian = _as_int(src.get("civilian"))
    non_muslim = _as_int(src.get("nonMuslim"))
    azad_hall_dist = _as_int(src.get("azadHallDist"))
    distribution = max(0, dad - azad_hall)
    total = others + civilian + non_muslim
    distribution2 = max(0, total - azad_hall_dist)
    return {
        "wing": wing,
        "officer": _as_int(src.get("officer")),
        "dad": dad,
        "azadHall": azad_hall,
        "distribution": distribution,
        "others": others,
        "civilian": civilian,
        "nonMuslim": non_muslim,
        "total": total,
        "azadHallDist": azad_hall_dist,
        "distribution2": distribution2,
        "totalDistribution": distribution + distribution2,
    }


def lock_rows(labels: tuple[str, ...], existing: list | None) -> list[dict]:
    by_wing = {}
    for row in existing or []:
        if isinstance(row, dict) and row.get("wing"):
            by_wing[str(row["wing"]).strip()] = row
    return [finalize_row(by_wing.get(label), label) for label in labels]


def lock_sheets(main_rows: list | None, admin_rows: list | None) -> tuple[list[dict], list[dict]]:
    return lock_rows(PRITIBHOJ_MAIN_LABELS, main_rows), lock_rows(PRITIBHOJ_ADMIN_LABELS, admin_rows)
