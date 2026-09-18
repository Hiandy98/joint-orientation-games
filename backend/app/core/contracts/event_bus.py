from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Callable
from uuid import uuid4
from datetime import datetime, timezone


@dataclass(frozen=True)
class Event:
    name: str
    payload: Dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


EventHandler = Callable[[Event], None]


class IEventBus(ABC):

    @abstractmethod
    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        """
        訂閱指定事件

        :param event_name: 事件名稱 (如: "user.created")
        :param handler: 事件觸發時要呼叫的 Callback 函式
        """
        pass

    @abstractmethod
    def publish(self, event_name: str, **kwargs: Any) -> None:
        """
        發布事件

        :param event_name: 事件名稱
        :param kwargs: 傳遞給訂閱者的資料，會被打包成 Event.payload
        """
        pass