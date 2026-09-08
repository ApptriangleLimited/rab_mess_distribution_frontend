"""p0 baseline — empty schema.

Revision ID: 0001_p0
Revises:
Create Date: 2026-09-08
"""

from typing import Sequence, Union

revision: str = "0001_p0"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
