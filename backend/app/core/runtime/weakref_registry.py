import inspect
import weakref
from typing import Any, Generic, TypeVar


T = TypeVar("T")


class WeakRefRegistry(Generic[T]):
    def __init__(self) -> None:
        self._refs: dict[str, list[Any]] = {}

    def add(self, key: str, target: T) -> None:
        if key not in self._refs:
            self._refs[key] = []

        active_targets, valid_refs = self._collect(key)
        if target not in active_targets:
            valid_refs.append(self._to_weakref(target))
            self._refs[key] = valid_refs

    def get_all(self, key: str) -> list[T]:
        """取得該 Key 底下所有仍存活的物件/Handlers，並自動清除無效引用"""
        active_targets, valid_refs = self._collect(key)
        self._refs[key] = valid_refs
        return active_targets

    def get_one(self, key: str) -> T | None:
        active = self.get_all(key)
        return active[0] if active else None

    def remove(self, key: str) -> None:
        self._refs.pop(key, None)

    @staticmethod
    def _to_weakref(target: Any) -> Any:
        if inspect.ismethod(target):
            return weakref.WeakMethod(target)
        return weakref.ref(target)

    def _collect(self, key: str) -> tuple[list[T], list[Any]]:
        active_targets: list[T] = []
        valid_refs: list[Any] = []

        for ref in self._refs.get(key, []):
            deref = ref()
            if deref is not None:
                active_targets.append(deref)
                valid_refs.append(ref)

        return active_targets, valid_refs