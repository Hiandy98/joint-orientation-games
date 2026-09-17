from abc import ABC, ABCMeta, abstractmethod
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

        if not hasattr(cls, "name") or not cls.name:
            raise TypeError(f"類別 {cls.__name__} 必須定義類別屬性 `name`")

        if not isinstance(cls.depends_on, list):
            raise TypeError(
                f"插件 '{cls.name}' 的 `depends_on` 必須是一個 list[str]"
            )

    def __init__(self, context: PluginContext) -> None:
        self.ctx = context
    