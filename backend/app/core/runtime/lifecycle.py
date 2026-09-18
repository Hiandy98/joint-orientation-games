import asyncio
import inspect
import logging

from graphlib import TopologicalSorter, CycleError
from typing import runtime_checkable, Protocol, Callable, Any

from app.core.contracts.plugin import PluginPriority

logger = logging.getLogger(__name__)


@runtime_checkable
class ILifecycle(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def depends_on(self) -> list: ...

    @property
    def priority(self) -> PluginPriority: ...

    async def start(self) -> None: ...
    async def stop(self) -> None: ...


class LifecycleManager:
    def __init__(self) -> None:
        self._managed_items: dict[str, ILifecycle] = {}
        self._started_items: list[str] = []

    def register(self, item: ILifecycle) -> None:
        if not isinstance(item, ILifecycle):
            raise TypeError(f"元件必須實現 ILifecycle 協議: {type(item).__name__}")

        if item.name in self._managed_items:
            raise ValueError(f"重複註冊的生命週期元件: [{item.name}]")

        self._managed_items[item.name] = item
        logger.debug(f"已註冊生命週期元件: [{item.name}], 依賴項: {item.depends_on}")

    async def start_all(self) -> None:
        order = self._get_tiered_startup_order()
        logger.info(f"系統啟動序列: {' -> '.join(order)}")

        for name in order:
            item = self._managed_items[name]
            level_str = item.priority.name
            
            logger.info(f"正在啟動 {level_str} 元件: [{name}]...")
            try:
                await self._execute_maybe_async(item.start)
                self._started_items.append(name)
                logger.info(f"{level_str} 元件 [{name}] 啟動成功")
                
            except Exception as e:
                logger.critical(
                    f"{level_str} 元件 [{name}] 啟動失敗"
                    f"退回所有插件並結束任務...", 
                    exc_info=True
                )
                await self.stop_all()
                raise RuntimeError(f"系統初始化失敗，卡在元件 [{name}]") from e

    async def stop_all(self) -> None:
        if not self._started_items:
            logger.debug("沒有任何已啟動的元件需要關閉")
            return
        
        logger.info("開始執行插件關閉序列...")
        for name in reversed(self._started_items):
            item = self._managed_items[name]
            level_str = item.priority.name
            
            logger.info(f"正在停止 {level_str} 元件: [{name}]...")
            try:
                await self._execute_maybe_async(item.stop)
                logger.info(f"{level_str} 元件 [{name}] 已關閉")
            except Exception as e:
                logger.error(f"{level_str} 元件 [{name}] 停止時發生異常: {e}", exc_info=True)
        
        self._started_items.clear()
        logger.info("關閉序列執行完畢")

    def _get_tiered_startup_order(self) -> list[str]:
        system_items: dict[str, set[str]] = {}
        app_items: dict[str, set[str]] = {}

        for name, item in self._managed_items.items():
            valid_deps = {dep for dep in item.depends_on if dep in self._managed_items}
            if item.priority == PluginPriority.SYSTEM:
                system_items[name] = valid_deps
            else:
                app_items[name] = valid_deps

        try:
            ts_system = TopologicalSorter(system_items)
            system_order = list(ts_system.static_order())

            ts_app = TopologicalSorter(app_items)
            app_order = list(ts_app.static_order())
            
            return system_order + app_order
            
        except CycleError as e:
            logger.critical(f"發現循環依賴: {e}")
            raise ValueError(f"生命週期元件存在循環依賴: {e}") from e


    async def _execute_maybe_async(self, func: Callable[[], Any]) -> None:
        result = func()
        if inspect.isawaitable(result):
            await result