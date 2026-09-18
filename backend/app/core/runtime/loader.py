import importlib
import inspect
import logging
import pkgutil
from typing import Type, Any

from app.core.contracts.plugin import BasePlugin


logger = logging.getLogger(__name__)


class PluginLoader:
    def __init__(self, plugins_package: str = "app.plugins"):
        self.plugins_package = plugins_package

    def discover_plugins_classes(self) -> list[Type[BasePlugin]]:
        try:
            package = importlib.import_module(self.plugins_package)
        except ModuleNotFoundError:
            logger.warning(f"找不到指定的插件包路徑: {self.plugins_package}")
            return []

        plugin_classes: list[Type[BasePlugin]] = []
        
        package_paths = list(package.__path__) if hasattr(package, "__path__") else []

        for _, module_name, _ in pkgutil.walk_packages(package_paths, f"{self.plugins_package}."):
            try:
                module = importlib.import_module(module_name)
            except Exception as e:
                logger.error(f"無法載入模組 [{module_name}]: {e}", exc_info=True)
                continue

            self._extract_plugins_from_module(module, module_name, plugin_classes)

        return plugin_classes

    def _extract_plugins_from_module(
        self, module: Any, module_name: str, registry: list[Type[BasePlugin]]
    ) -> None:
        """從單一模組中篩選出合法且定義在該模組內的插件類別"""
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if self._is_valid_plugin(obj, module_name):
                plugin_cls: Type[BasePlugin] = obj  # type: ignore
                if plugin_cls not in registry:
                    registry.append(plugin_cls)

    def _is_valid_plugin(self, obj: Type, module_name: str) -> bool:
        """檢查該類別是否為目前模組內定義的具體插件類別"""
        return (
            issubclass(obj, BasePlugin)
            and obj is not BasePlugin
            and not inspect.isabstract(obj)
            and obj.__module__ == module_name
        )
