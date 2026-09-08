from app.constants import ROLES, SEED_EMAIL


def _login(client, email: str = "daily@mess.rab", password: str = "ChangeMe!"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_seed_login_each_role(client) -> None:
    for role in ROLES:
        res = _login(client, SEED_EMAIL.format(role=role))
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 28800
        assert data["access_token"]
        assert data["staff"]["role"] == role
        assert data["staff"]["email"] == SEED_EMAIL.format(role=role)


def test_bad_password_same_as_unknown_email(client) -> None:
    bad = _login(client, password="wrong")
    unknown = _login(client, email="nobody@mess.rab", password="ChangeMe!")
    assert bad.status_code == 401
    assert unknown.status_code == 401
    assert bad.json()["code"] == "INVALID_CREDENTIALS"
    assert unknown.json()["code"] == "INVALID_CREDENTIALS"
    assert bad.json()["detail"] == unknown.json()["detail"]


def test_me_and_logout_denies_token(client) -> None:
    token = _login(client).json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    body = me.json()["data"]
    assert body["role"] == "daily"
    assert body["active"] is True

    out = client.post("/api/v1/auth/logout", headers=headers)
    assert out.status_code == 204

    again = client.get("/api/v1/auth/me", headers=headers)
    assert again.status_code == 401
    assert again.json()["ok"] is False
    assert again.json()["code"] == "UNAUTHORIZED"


def test_me_without_token(client) -> None:
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"


def test_eleventh_login_same_ip_rate_limited(client) -> None:
    for i in range(10):
        res = _login(client, email=f"burst{i}@mess.rab", password="nope")
        assert res.status_code == 401
    blocked = _login(client, email="burst10@mess.rab", password="nope")
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "RATE_LIMITED"


def test_login_rate_limit_fail_closed_when_redis_down(client, monkeypatch) -> None:
    from redis.exceptions import RedisError

    from app.services import rate_limit

    def boom() -> None:
        raise RedisError("down")

    monkeypatch.setattr(rate_limit, "get_redis", boom)
    res = _login(client)
    assert res.status_code == 503
    assert res.json()["code"] == "REDIS_UNAVAILABLE"
