import inspect
import logging
import weakref
from typing import Any, Callable

from app.core.contracts.service import IService
from app.core.runtime.weakref_registry import WeakRefRegistry


logger = logging.getLogger(__name__)


class _ServiceProxy:

    def __init__(self, service_name: str, target_service: IService) -> None:
        self._service_name = service_name
        self._target_ref = weakref.ref(target_service)

    def __getattr__(self, method_name: str) -> Callable[..., Any]:
        target = self._target_ref()
        if target is None:
            raise RuntimeError(f"服務 [{self._service_name}] 已失效或被卸載")

        attr = getattr(target, method_name, None)
        if method_name.startswith("_") or not callable(attr):
            raise AttributeError(f"服務 [{self._service_name}] 不存在可呼叫的方法 '{method_name}'")

        return self._create_safe_wrapper(method_name, attr)

    def _create_safe_wrapper(self, method_name: str, method: Callable) -> Callable:
        def wrap_error(e: Exception) -> RuntimeError:
            logger.error(f"呼叫服務 [{self._service_name}.{method_name}] 失敗: {e}", exc_info=True)
            return RuntimeError(f"服務 [{self._service_name}] 執行時發生錯誤: {e}")

        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await method(*args, **kwargs)
            except Exception as e:
                raise wrap_error(e) from e

        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return method(*args, **kwargs)
            except Exception as e:
                raise wrap_error(e) from e

        if inspect.iscoroutinefunction(method):
            return async_wrapper
        return sync_wrapper


class ServiceContainer:

    def __init__(self) -> None:
        self._registry = WeakRefRegistry[IService]()

    def register(self, service_name: str, service: IService) -> None:
        if not isinstance(service, IService):
            raise TypeError("註冊的服務必須繼承自 IService")
        self._registry.add(service_name, service)

    def get(self, service_name: str) -> _ServiceProxy:
        service = self._registry.get_one(service_name)
        if service is None:
            raise RuntimeError(f"找不到請求的服務: [{service_name}]")
        return _ServiceProxy(service_name, service)
