from sqlalchemy import func


def iexact(column, value: str):
    return func.lower(column) == value.strip().lower()
