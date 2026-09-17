from abc import ABC
from enum import Enum
import inspect
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

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)

        if cls._is_abstract_class():
            return
        
        cls._validate_identity_defined()
        cls._validate_dependencies_format()
        cls._validate_priority_format()

    def __init__(self) -> None:
        self._ctx: PluginContext | None = None

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

    @classmethod
    def _validate_identity_defined(cls) -> None:
        has_name = "name" in cls.__dict__
        is_empty = not cls.__dict__.get("name")
        if not has_name or is_empty:
            raise TypeError(f"類別 '{cls.__name__}' 必須明確定義類別屬性 `name` (且不能為空字串)")

    @classmethod
    def _validate_dependencies_format(cls) -> None:
        deps = cls.__dict__.get("depends_on", cls.depends_on)
        is_list = isinstance(deps, list)
        all_items_are_str = is_list and all(isinstance(x, str) for x in deps)
        if not is_list or not all_items_are_str:
            raise TypeError(f"類別 '{cls.__name__}' 的 `depends_on` 必須是 list[str]")

    @classmethod
    def _validate_priority_format(cls) -> None:
        prio = cls.__dict__.get("priority", cls.priority)
        if not isinstance(prio, PluginPriority):
            raise TypeError(f"類別 '{cls.__name__}' 的 `priority` 必須是 PluginPriority 枚舉項")

    @classmethod
    def _is_abstract_class(cls) -> bool:
        return inspect.isabstract(cls)