import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response

from database import SessionLocal
from zk_gate import ingest_adms_attendance, note_adms

logger = logging.getLogger("zkteco.adms")

router = APIRouter(
    prefix="/iclock",
    tags=["ZKTeco ADMS"],
)


def plain_text(content: str = "OK") -> Response:
    return Response(
        content=content,
        media_type="text/plain",
        headers={
            "Cache-Control": "no-store",
        },
    )


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()

    if forwarded:
        return forwarded.split(",")[0].strip()

    if request.client:
        return request.client.host

    return ""


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


def _save_punches(body: str, table_name: str) -> None:
    if table_name not in {"", "ATTLOG"}:
        return
    records = _punches(body)
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

    logger.info(
        "ZKTeco handshake serial=%s client=%s query=%s",
        serial_number,
        client_ip(request),
        query,
    )

    if serial_number:
        note_adms(serial_number)

    current_timestamp = int(datetime.now(timezone.utc).timestamp())

    response = (
        f"GET OPTION FROM: {serial_number}\r\n"
        "Stamp=9999\r\n"
        f"OpStamp={current_timestamp}\r\n"
        "PhotoStamp=9999\r\n"
        "ErrorDelay=60\r\n"
        "Delay=10\r\n"
        "TransTimes=00:00;14:05\r\n"
        "TransInterval=1\r\n"
        "TransFlag=1111000000\r\n"
        "Realtime=1\r\n"
        "Encrypt=0\r\n"
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

    logger.info(
        "ZKTeco data serial=%s table=%s client=%s records=%d body=%r",
        serial_number,
        table_name,
        client_ip(request),
        len(records),
        body,
    )

    if serial_number:
        note_adms(serial_number)
    _save_punches(body, table_name)

    return plain_text(f"OK: {len(records)}")


@router.get("/getrequest")
async def device_getrequest(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()

    logger.info(
        "ZKTeco poll serial=%s client=%s",
        serial_number,
        client_ip(request),
    )

    if serial_number:
        note_adms(serial_number)

    return plain_text("OK")


@router.post("/getrequest")
async def device_getrequest_post(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    body = (await request.body()).decode("utf-8", errors="replace")

    logger.info(
        "ZKTeco poll POST serial=%s client=%s body=%r",
        serial_number,
        client_ip(request),
        body,
    )

    if serial_number:
        note_adms(serial_number)

    return plain_text("OK")


@router.get("/devicecmd")
async def device_command_get(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()

    logger.info(
        "ZKTeco devicecmd GET serial=%s client=%s",
        serial_number,
        client_ip(request),
    )

    if serial_number:
        note_adms(serial_number)

    return plain_text("OK")


@router.post("/devicecmd")
async def device_command_post(request: Request) -> Response:
    serial_number = request.query_params.get("SN", "").strip()
    body = (await request.body()).decode("utf-8", errors="replace")

    logger.info(
        "ZKTeco devicecmd POST serial=%s client=%s body=%r",
        serial_number,
        client_ip(request),
        body,
    )

    if serial_number:
        note_adms(serial_number)

    return plain_text("OK")
