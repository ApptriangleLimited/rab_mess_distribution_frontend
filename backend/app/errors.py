from typing import Any


class AppError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        detail: str,
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail
        self.errors = errors or []


class FieldError(dict):
    def __init__(self, field: str, code: str, message: str) -> None:
        super().__init__(field=field, code=code, message=message)
