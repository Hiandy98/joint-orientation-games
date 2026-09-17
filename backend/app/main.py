import logging

from fastapi import FastAPI

from app.core.runtime.logging_config import LoggerParameter, Logger 


log_params = LoggerParameter(
    logging_level="DEBUG",
    do_session_log=True,
    do_console_log=True,
    do_master_log=True,
    is_colorful_console=True
)
Logger.init(log_params)

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    logger.info("Starting system factory: creating app instance...")

    app = FastAPI()

    logger.info("Application factory completed successfully.")
    return app