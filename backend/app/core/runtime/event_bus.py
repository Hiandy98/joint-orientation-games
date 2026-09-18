import logging
import inspect
import weakref

from typing import Dict, List, Any
from collections import defaultdict

from app.core.contracts.event_bus import IEventBus, Event, EventHandler


logger = logging.getLogger(__name__)


class EventBus(IEventBus):

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Any]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        if not self._is_already_subscribed_and_clean(event_name, handler):
            ref = self._to_weakref(handler)
            self._subscribers[event_name].append(ref)

    def unsubscribe(self, event_name: str, handler: EventHandler) -> None:
        self._subscribers[event_name] = [
            ref for ref in self._subscribers[event_name]
            if self._should_keep_ref(ref, target_handler=handler)
        ]

    def publish(self, event_name: str, payload: Dict[str, Any] | None = None) -> None:
        event = Event(name=event_name, payload=payload or {})
        active_handlers = self._get_and_clean_handlers(event_name)

        for handler in active_handlers:
            self._execute_handler(handler, event)

    def _to_weakref(self, handler: EventHandler) -> Any:
        if inspect.ismethod(handler):
            return weakref.WeakMethod(handler)
        return weakref.ref(handler)

    def _unpack_ref(self, ref: Any) -> EventHandler | None:
        return ref()

    def _should_keep_ref(self, ref: Any, target_handler: EventHandler) -> bool:
        current_handler = self._unpack_ref(ref)
        return current_handler is not None and current_handler != target_handler

    def _get_and_clean_handlers(self, event_name: str) -> List[EventHandler]:
        active_handlers, valid_refs = self._filter_active_subscribers(event_name)

        self._subscribers[event_name] = valid_refs
        return active_handlers

    def _filter_active_subscribers(self, event_name: str) -> tuple[List[EventHandler], List[Any]]:
        active_handlers: List[EventHandler] = []
        valid_refs: List[Any] = []

        for ref in self._subscribers[event_name]:
            handler = self._unpack_ref(ref)
            if handler is not None:
                active_handlers.append(handler)
                valid_refs.append(ref)

        return active_handlers, valid_refs

    def _is_already_subscribed_and_clean(self, event_name: str, handler: EventHandler) -> bool:
        active_handlers, valid_refs = self._filter_active_subscribers(event_name)
        self._subscribers[event_name] = valid_refs
        return handler in active_handlers

    def _execute_handler(self, handler: EventHandler, event: Event) -> None:
        try:
            handler(event)
        except Exception as e:
            handler_name = getattr(handler, "__name__", str(handler))
            logger.error(
                f"Execution failed for handler '{handler_name}' on event '{event.name}': {e}",
                exc_info=True,
            )