class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def ping(self) -> bool:
        return True

    def incr(self, key: str) -> int:
        n = int(self.data.get(key, "0")) + 1
        self.data[key] = str(n)
        return n

    def expire(self, key: str, _seconds: int) -> bool:
        return key in self.data

    def exists(self, key: str) -> int:
        return 1 if key in self.data else 0

    def set(self, key: str, value: str, ex: int | None = None, nx: bool = False, **_kwargs) -> bool:
        if nx and key in self.data:
            return False
        self.data[key] = str(value)
        return True

    def get(self, key: str) -> str | None:
        return self.data.get(key)

    def delete(self, *keys: str) -> int:
        n = 0
        for key in keys:
            if key in self.data:
                del self.data[key]
                n += 1
        return n

    def lpush(self, key: str, *values: str) -> int:
        cur = self.data.get(key, "")
        items = [v for v in cur.split("\0") if v] if cur else []
        for value in reversed(values):
            items.insert(0, str(value))
        self.data[key] = "\0".join(items)
        return len(items)

    def brpop(self, key: str, timeout: int = 0):
        cur = self.data.get(key, "")
        items = [v for v in cur.split("\0") if v] if cur else []
        if not items:
            return None
        value = items.pop()
        if items:
            self.data[key] = "\0".join(items)
        else:
            self.data.pop(key, None)
        return key, value
