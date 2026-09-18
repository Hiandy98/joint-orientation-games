import asyncio
import logging
import inspect
import weakref

from typing import List, Any

from app.core.contracts.event_bus import IEventBus, Event, EventHandler
from app.core.runtime.weakref_registry import WeakRefRegistry


logger = logging.getLogger(__name__)


class _SubscriberRegistry:

    def __init__(self) -> None:
        self._registry = WeakRefRegistry[EventHandler]()

    def add(self, event_name: str, handler: EventHandler) -> None:
        self._registry.add(event_name, handler)

    def get_active(self, event_name: str) -> list[EventHandler]:
        return self._registry.get_all(event_name)


class _HandlerExecutor:
    """
    支援同步與非同步 handler，自己記得非同步要await。
    """

    async def run_all(
        self, handlers: List[EventHandler], event: Event, *, concurrent: bool = True,
    ) -> None:
        if not handlers:
            return

        if concurrent:
            await self._run_concurrently(handlers, event)
        else:
            await self._run_sequentially(handlers, event)

    async def _run_concurrently(self, handlers: List[EventHandler], event: Event) -> None:
        """執行+蒐集異常"""
        await asyncio.gather(
            *(self._run_one(h, event) for h in handlers),
            return_exceptions=True,
        )

    async def _run_sequentially(self, handlers: List[EventHandler], event: Event) -> None:
        for handler in handlers:
            await self._run_one(handler, event)

    async def _run_one(self, handler: EventHandler, event: Event) -> None:
        """會自動識別並處理非同步/同步，並捕獲其異常"""
        try:
            result = handler(event)
            if inspect.isawaitable(result):
                await result
        except Exception as e:
            self._handle_exception(handler, event, e)

    def _handle_exception(self, handler: EventHandler, event: Event, e: Exception) -> None:
        handler_name = getattr(handler, "__name__", str(handler))
        logger.error(
            f"Execution failed for handler '{handler_name}' "
            f"on event '{event.name}': {e}",
            exc_info=True,
        )


class EventBus(IEventBus):

    def __init__(self) -> None:
        self._subscribers = _SubscriberRegistry()
        self._executor = _HandlerExecutor()

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        self._subscribers.add(event_name, handler)

    async def publish(
        self, event_name: str, *, gather: bool = True, **kwargs: Any
    ) -> None:
        """
        非同步發布事件。

        :param event_name: 事件名稱
        :param gather: True 時並發執行所有 handler; False 時按訂閱順序串行執行
        :param kwargs: 傳遞給訂閱者的資料，會被打包成 Event.payload
        """
        event = Event(name=event_name, payload=kwargs)
        handlers = self._subscribers.get_active(event_name)
        await self._executor.run_all(handlers, event, concurrent=gather)