from abc import ABC
from enum import Enum
from typing import Any


class PluginPriority(Enum):
    SYSTEM = 0
    APP = 1


class PluginContext:
    def __init__(self, services: Any, events: Any, logger: Any) -> None:
        self.services = services
        self.events = events
        self.logger = logger


class BasePlugin(ABC):
    name: str = ""  
    priority: PluginPriority = PluginPriority.APP
    depends_on: list[str] = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

        if "name" not in cls.__dict__ or not cls.__dict__["name"]:
            raise TypeError(f"類別 '{cls.__name__}' 必須明確定義類別屬性 `name` (且不能為空字串)")

        if not isinstance(cls.depends_on, list) or not all(isinstance(x, str) for x in cls.depends_on):
            raise TypeError(f"插件 '{cls.name}' 的 `depends_on` 必須是 list[str]")

        if not isinstance(cls.priority, PluginPriority):
            raise TypeError(f"插件 '{cls.name}' 的 `priority` 必須是 PluginPriority 枚舉項")
        
    def __init__(self, context: PluginContext) -> None:
        self._ctx = context

    @property
    def ctx(self) -> PluginContext:
        if self._ctx is None:
            raise RuntimeError(f"拒絕存取: 插件 [{self.name}] 尚未進入註冊階段, ctx 尚未注入")
        return self._ctx

    def register(self, context: PluginContext) -> None:
        """
        註冊階段說明
        - 僅用於向 `self.ctx.services` 註冊提供給外部的服務。
        - 僅用於向 `self.ctx.events` 訂閱事件。
        - "禁止"在此階段進行 DB 操作、網路連線或觸發業務邏輯。
        """
        self._ctx = context

    def start(self) -> None:
        """
        啟動階段說明
        - 所有插件完成註冊後按依賴順序調用。
        - 可在此進行資料庫初始化連線、啟動定時任務或觸發初始化等的業務邏輯。
        """
        pass

    def stop(self) -> None:
        """
        停用/資源釋放階段說明
        - 系統關閉或插件卸載時呼叫，用於關閉連線池、釋放記憶體資源。
        """
        pass