from abc import ABC
from dataclasses import dataclass
import inspect
import logging
from enum import Enum
from typing import Any, Callable, ClassVar

logger = logging.getLogger(__name__)


EventHandler = Callable[..., Any]


def on_event(event_name: str) -> Callable[[EventHandler], EventHandler]:
    def decorator(func: EventHandler) -> EventHandler:
        func.__event_binding__ = event_name  # type: ignore
        return func
    return decorator


class PluginPriority(Enum):
    SYSTEM = 0
    APP = 1


@dataclass
class PluginContext:
    services: Any
    events: Any
    logger: logging.Logger


class BasePlugin(ABC):
    name: ClassVar[str] = ""
    priority: ClassVar[PluginPriority] = PluginPriority.APP
    depends_on: ClassVar[list[str]] = []
    _event_bindings: ClassVar[dict[str, str]] = {}

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)

        if inspect.isabstract(cls):
            return

        # 每個子類別複製一份 depends_on，避免共享可變預設值
        cls.depends_on = list(cls.__dict__.get("depends_on", cls.depends_on))

        cls._validate_identity_defined()
        cls._validate_dependencies_format()
        cls._validate_priority_format()

        cls._event_bindings = cls._collect_event_bindings()

    def __init__(self) -> None:
        self._ctx: PluginContext | None = None

    @property
    def ctx(self) -> PluginContext:
        if self._ctx is None:
            raise RuntimeError(
                f"拒絕存取: 插件 [{self.name}] 尚未進入註冊階段, ctx 尚未注入"
            )
        return self._ctx

    def register(self, context: PluginContext) -> None:
        """Core 階段註冊：注入 Context、自動綁定事件、呼叫 on_register()。"""
        self._ctx = context
        self._auto_register_events()
        self.on_register()

    def on_register(self) -> None:
        """可選覆寫：向 `self.ctx.services` 註冊外部服務。

        禁止進行 DB 操作、網路連線。
        """
        pass

    async def start(self) -> None:
        """啟動階段：所有插件完成註冊後按依賴順序調用。"""
        pass

    async def stop(self) -> None:
        """停用/資源釋放階段：系統關閉或插件卸載時呼叫。"""
        pass

    def _auto_register_events(self) -> None:
        """向 EventBus 訂閱所有以 @on_event 標記的方法。"""
        if self.ctx.events is None:
            return

        for method_name, event_name in self._event_bindings.items():
            self.ctx.events.subscribe(event_name, getattr(self, method_name))

    @classmethod
    def _collect_event_bindings(cls) -> dict[str, str]:
        """沿 MRO 收集所有 @on_event 方法，回傳 {方法名: 事件名}。

        子類別覆寫同名方法時以子類別為準：若子類別覆寫的方法沒有 @on_event，
        父類別的同名綁定會被捨棄。
        """
        bindings: dict[str, str | None] = {}
        for base in cls.__mro__:
            for attr_name, attr in vars(base).items():
                if attr_name in bindings:
                    continue
                bindings[attr_name] = getattr(attr, "__event_binding__", None)
        return {k: v for k, v in bindings.items() if v is not None}

    @classmethod
    def _validate_identity_defined(cls) -> None:
        if not cls.__dict__.get("name"):
            raise TypeError(
                f"類別 '{cls.__name__}' 必須明確定義非空類別屬性 `name`"
            )

    @classmethod
    def _validate_dependencies_format(cls) -> None:
        deps = cls.depends_on
        if not isinstance(deps, list) or not all(isinstance(x, str) for x in deps):
            raise TypeError(
                f"類別 '{cls.__name__}' 的 `depends_on` 必須是 list[str]"
            )

    @classmethod
    def _validate_priority_format(cls) -> None:
        if not isinstance(cls.priority, PluginPriority):
            raise TypeError(
                f"類別 '{cls.__name__}' 的 `priority` 必須是 PluginPriority 枚舉項"
            )