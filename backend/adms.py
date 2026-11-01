import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Request, Response

from database import SessionLocal
from zk_gate import ingest_adms_attendance, note_adms

try:
    from zk_gate import pop_adms_command
except Exception:
    def pop_adms_command() -> str:
        return ""

try:
    from adms_store import pop_adms_command as pop_file_command
except Exception:
    def pop_file_command() -> str:
        return ""

logger = logging.getLogger("zkteco.adms")
AUDIT_LOG = Path("/var/lib/rab-mess/files/adms_http.log")
REGISTERED_FLAG = Path("/var/lib/rab-mess/files/adms_registered.txt")
ADMS_CMD_PATH = Path("/var/lib/rab-mess/files/adms_cmds.json")

router = APIRouter(
    prefix="/iclock",
    tags=["ZKTeco ADMS"],
)


def handshake_options(serial_number: str) -> str:
    command = _peek_commands()
    if command:
        return command
    return chr(10).join(
        [
            "GET OPTION FROM: " + serial_number,
            "ATTLOGStamp=None",
            "OPERLOGStamp=None",
            "ATTPHOTOStamp=None",
            "ErrorDelay=30",
            "Delay=10",
            "TransTimes=00:00;14:05",
            "TransInterval=1",
            "TransFlag=TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP UserPic",
            "TimeZone=6",
            "Realtime=1",
            "Encrypt=None",
            "ServerVer=3.1.2",
            "PushProtVer=3.1.2",
            "PushOptionsFlag=1",
            "PushOptions=RegDeviceType,FingerFunOn,FaceFunOn,FPVersion,FaceVersion,NetworkType,HardwareId3,HardwareId5,HardwareId56,LicenseStatus3,LicenseStatus5,LicenseStatus56",
            "",
        ]
    )


def plain_text(content: str = "OK") -> Response:
    response = Response(content=content)
    response.headers["content-type"] = "text/plain"
    response.headers["cache-control"] = "no-store"
    response.headers["pragma"] = "no-cache"
    return response


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()

    if forwarded:
        return forwarded.split(",")[0].strip()

    if request.client:
        return request.client.host

    return ""


def _audit(kind: str, request: Request, extra: str = "") -> None:
    line = (
        f"{datetime.now(timezone.utc).isoformat()} {kind} "
        f"ip={client_ip(request)} q={dict(request.query_params)} {extra}\n"
    )
    try:
        AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_LOG.open("a", encoding="utf-8") as handle:
            handle.write(line)
    except OSError:
        pass
    logger.info("%s", line.strip())


def _take_command() -> str:
    try:
        command = pop_adms_command() or pop_file_command()
    except Exception as exc:
        logger.warning("ADMS pop failed: %s", exc)
        return ""
    if command and not command.endswith("\n"):
        return f"{command}\n"
    return command


def _peek_commands() -> str:
    rows: list = []
    try:
        import json

        raw = json.loads(ADMS_CMD_PATH.read_text(encoding="utf-8"))
        rows = list(raw.get("cmds") or [])
    except Exception:
        try:
            from adms_store import pending
            rows = list(pending() or [])
        except Exception:
            try:
                from zk_gate import pending_adms_commands
                rows = list(pending_adms_commands() or [])
            except Exception:
                rows = []
    lines: list[str] = []
    for row in rows:
        if isinstance(row, dict):
            text = str(row.get("line") or row.get("cmd") or row.get("command") or "")
        else:
            text = str(row)
        text = text.strip()
        if text:
            lines.append(text)
    if not lines:
        return ""
    return chr(10).join(lines) + chr(10)


def _punches(body: str) -> list[tuple[str, datetime]]:
    from zk_gate import _parse_punched_at

    found: list[tuple[str, datetime]] = []
    for line in body.splitlines():
        text = line.strip()
        if not text or "\t" not in text:
            continue
        pin, raw_time, *_rest = text.split("\t")
        pin = pin.strip()
        punched = _parse_punched_at(raw_time.strip())
        if pin and punched is not None and "=" not in pin:
            found.append((pin, punched))
    return found


def _mark_registered(serial: str) -> None:
    if not serial:
        return
    try:
        REGISTERED_FLAG.parent.mkdir(parents=True, exist_ok=True)
        REGISTERED_FLAG.write_text(f"{serial} {time.time()}\n", encoding="utf-8")
    except OSError:
        pass


def _is_registered(serial: str, window: float = 900) -> bool:
    if not serial:
        return False
    try:
        stored_sn, stamp = REGISTERED_FLAG.read_text(encoding="utf-8").split()
    except (OSError, ValueError):
        return False
    return stored_sn == serial and (time.time() - float(stamp)) < window


def _drop_acked(body: str) -> None:
    if "Return=0" not in body.replace(" ", ""):
        return
    ids = {int(item) for item in re.findall(r"ID=(\d+)", body)}
    if not ids:
        return
    try:
        import json

        raw = json.loads(ADMS_CMD_PATH.read_text(encoding="utf-8"))
        cmds = [row for row in raw.get("cmds", []) if int(row.get("id") or 0) not in ids]
        raw["cmds"] = cmds
        ADMS_CMD_PATH.write_text(json.dumps(raw), encoding="utf-8")
    except (OSError, ValueError, TypeError):
        pass


def _rtlog_rows(body: str) -> list[dict]:
    from zk_gate import _parse_punched_at

    found: list[dict] = []
    for line in body.splitlines():
        fields: dict[str, str] = {}
        for part in line.strip().split("\t"):
            if "=" not in part:
                continue
            key, value = part.split("=", 1)
            fields[key.strip().lower()] = value.strip()
        pin = fields.get("pin", "").strip()
        card = "".join(ch for ch in fields.get("cardno", "") if ch.isdigit())
        punched = _parse_punched_at(fields.get("time", ""))
        key = pin if pin and pin != "0" else card.lstrip("0") or card
        if punched is None or not key:
            continue
        found.append(
            {
                "key": key,
                "pin": pin,
                "card": card,
                "punched": punched,
                "event": fields.get("event", "0"),
            }
        )
    return found


def _bind_rtlog_cards(rows: list[dict]) -> None:
    from models import Member
    from zk_gate import rfid_card, sync_member_to_device

    db = SessionLocal()
    try:
        for row in rows:
            pin = str(row.get("pin") or "")
            value = rfid_card(str(row.get("card") or ""))
            if not pin or pin == "0" or value <= 0:
                continue
            member = (
                db.query(Member)
                .filter((Member.personal_id == pin) | (Member.rab_id == pin))
                .first()
            )
            if member is None or rfid_card(member.rfid) == value:
                continue
            member.rfid = str(value).zfill(10)
            db.commit()
            try:
                sync_member_to_device(member)
            except Exception as exc:
                logger.warning("ADMS bind enqueue failed pin=%s err=%s", pin, exc)
    finally:
        db.close()


def _rtlog_punches(body: str) -> list[tuple[str, datetime]]:
    return [(row["key"], row["punched"]) for row in _rtlog_rows(body)]


def _save_punches(body: str, table_name: str) -> None:
    if table_name in {"", "ATTLOG"}:
        records = _punches(body)
    elif table_name == "RTLOG":
        rows = _rtlog_rows(body)
        _bind_rtlog_cards(rows)
        records = [(row["key"], row["punched"]) for row in rows]
    else:
        return
    if not records:
        return
    db = SessionLocal()
    try:
        ingest_adms_attendance(db, records)
    finally:
        db.close()


@router.get("/cdata")
async def device_handshake(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    query = dict(request.query_params)

    _audit("cdata_get", request, f"serial={serial_number} query={query}")

    if serial_number:
        note_adms(serial_number)

    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    options_all = str(query.get("options") or "").lower() == "all"

    if options_all:
        command = _peek_commands()
        if command:
            _audit("cdata_get_cmd", request, f"serial={serial_number} cmd={command!r}")
            return plain_text(command)
        response = handshake_options(serial_number)
    else:
        response = chr(10).join(
            [
                "GET OPTION FROM: " + serial_number,
                "Stamp=9999",
                "OpStamp=" + str(current_timestamp),
                "PhotoStamp=9999",
                "ErrorDelay=60",
                "Delay=10",
                "TransTimes=00:00;14:05",
                "TransInterval=1",
                "TransFlag=1111000000",
                "Realtime=1",
                "Encrypt=0",
                "",
            ]
        )

    return plain_text(response)


@router.post("/cdata")
async def receive_device_data(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    table_name = request.query_params.get("table", "").strip().upper()

    raw_body = await request.body()
    body = raw_body.decode("utf-8", errors="replace")

    records = [
        line
        for line in body.splitlines()
        if line.strip()
    ]

    _audit(
        "cdata_post",
        request,
        f"serial={serial_number} table={table_name} records={len(records)} body={body!r}",
    )

    if serial_number:
        note_adms(serial_number)
    _save_punches(body, table_name)

    if table_name in {"", "OPTIONS", "OPERLOG", "USERINFO"}:
        return plain_text("OK")
    return plain_text(f"OK: {len(records)}")


@router.get("/getrequest")
async def device_getrequest(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    _audit("getrequest_get", request, f"serial={serial_number}")

    if serial_number:
        note_adms(serial_number)

    command = _take_command()
    _audit("getrequest_cmd", request, f"serial={serial_number} cmd={command!r}")
    if command:
        return plain_text(command)
    return plain_text("OK")


@router.post("/getrequest")
async def device_getrequest_post(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    body = (await request.body()).decode("utf-8", errors="replace")

    if serial_number:
        note_adms(serial_number)

    command = _take_command()
    _audit(
        "getrequest_post",
        request,
        f"serial={serial_number} body={body!r} cmd={command!r}",
    )
    if command:
        return plain_text(command)
    return plain_text("OK")


@router.get("/devicecmd")
async def device_command_get(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()

    _audit("devicecmd_get", request, f"serial={serial_number}")

    if serial_number:
        note_adms(serial_number)

    return plain_text("OK")


@router.post("/devicecmd")
async def device_command_post(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    body = (await request.body()).decode("utf-8", errors="replace")

    _audit("devicecmd_post", request, f"serial={serial_number} body={body!r}")

    if serial_number:
        note_adms(serial_number)
    _drop_acked(body)

    return plain_text("OK")


@router.api_route("/registry", methods=["GET", "POST"])
async def device_registry(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    body = (await request.body()).decode("utf-8", errors="replace")
    _audit("registry", request, f"serial={serial_number} body={body!r}")
    if serial_number:
        note_adms(serial_number)
        _mark_registered(serial_number)
    extra = _peek_commands()
    _audit("registry_cmds", request, f"serial={serial_number} cmds={extra!r}")
    return plain_text("OK" + chr(10) + extra)


@router.api_route("/ping", methods=["GET", "POST"])
async def device_ping(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    _audit("ping", request, f"serial={serial_number}")
    if serial_number:
        note_adms(serial_number)
    return plain_text("OK")


@router.api_route("/exchange", methods=["GET", "POST"])
async def device_exchange(request: Request) -> Response:
    body = (await request.body()).decode("utf-8", errors="replace")
    _audit("exchange", request, f"body={body!r}")
    return plain_text("OK")


@router.api_route("/{extra:path}", methods=["GET", "POST"])
async def device_unknown(extra: str, request: Request) -> Response:
    body = (await request.body()).decode("utf-8", errors="replace")
    _audit("unknown", request, f"path={extra} body={body!r}")
    return plain_text("OK")
