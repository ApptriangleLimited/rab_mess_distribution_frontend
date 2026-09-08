ROLES = ("cc", "daily", "mess", "consume", "ration", "admin")

SEED_STAFF = (
    ("st_cc", "cc", "CC Desk"),
    ("st_daily", "daily", "Daily Desk"),
    ("st_mess", "mess", "Mess Desk"),
    ("st_consume", "consume", "Consume Desk"),
    ("st_ration", "ration", "Ration Desk"),
    ("st_admin", "admin", "Admin Desk"),
)

SEED_EMAIL = "{role}@mess.rab"
LOGIN_IP_LIMIT = 10
LOGIN_EMAIL_LIMIT = 5
LOGIN_WINDOW_SEC = 15 * 60
REGISTER_IP_LIMIT = 5
REGISTER_GLOBAL_LIMIT = 20
REGISTER_WINDOW_SEC = 60 * 60
CACHE_CATALOG_TTL = 60
CACHE_RATES_TTL = 30
CACHE_CATALOG_KEY = "cache:catalog"
CACHE_RATES_KEY = "cache:rates"
CACHE_ZK_STATUS = "zk:status"
CACHE_ZK_USERS = "zk:users"
CACHE_ZK_ATTENDANCE = "zk:attendance"
ZK_STATUS_TTL = 120
