from app.routers import health as health_routes


def test_live_200(client) -> None:
    res = client.get("/api/v1/live")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["data"]["status"] == "ok"
    assert res.headers.get("X-Request-ID")


def test_health_ok(client, monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "ping_db", lambda: True)
    monkeypatch.setattr(health_routes, "ping_redis", lambda: True)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "ok"
    assert data["db"] == "ok"
    assert data["redis"] == "ok"


def test_health_degraded_still_200(client, monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "ping_db", lambda: False)
    monkeypatch.setattr(health_routes, "ping_redis", lambda: True)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "degraded"
    assert data["db"] == "down"


def test_ready_200(client, monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "ping_db", lambda: True)
    monkeypatch.setattr(health_routes, "ping_redis", lambda: True)
    res = client.get("/api/v1/ready")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_ready_503_when_db_down(client, monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "ping_db", lambda: False)
    monkeypatch.setattr(health_routes, "ping_redis", lambda: True)
    res = client.get("/api/v1/ready")
    assert res.status_code == 503
    body = res.json()
    assert body["ok"] is False
    assert body["code"] == "NOT_READY"


def test_metrics_raw_prometheus(client) -> None:
    client.get("/api/v1/live")
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "http_requests_total" in res.text
    assert "ok" not in res.text[:20] or not res.text.strip().startswith("{")


def test_404_envelope(client) -> None:
    res = client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    body = res.json()
    assert body["ok"] is False
    assert body["code"] == "NOT_FOUND"
    assert "errors" in body
