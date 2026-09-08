from datetime import date

from app.domain.dates import today_dhaka, yesterday_dhaka


def apply_status_to_spans(
    spans: list[tuple[date, date | None]],
    status: str,
    joining: date | None,
) -> list[tuple[date, date | None]]:
    """Port of frontend applyStatusToSpans."""
    today = today_dhaka()
    next_spans = list(spans)
    if status == "0":
        if not any(to is None for _from, to in next_spans):
            from_date = joining if joining and joining < today else today
            next_spans.append((from_date, None))
        return next_spans

    yesterday = yesterday_dhaka()
    has_open = any(to is None for _from, to in next_spans)
    if not has_open:
        if joining and joining <= yesterday:
            from_date = joining
        elif next_spans:
            from_date = yesterday
        else:
            from_date = date(1970, 1, 1)
        if from_date <= yesterday:
            next_spans.append((from_date, yesterday))
        return next_spans

    closed: list[tuple[date, date | None]] = []
    for start, end in next_spans:
        if end is not None:
            closed.append((start, end))
            continue
        if start > yesterday:
            continue
        closed.append((start, yesterday))
    return closed
