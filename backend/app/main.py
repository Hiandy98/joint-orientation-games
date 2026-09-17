import logging

from fastapi import FastAPI


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    logging.info("Starting system factory: creating app instance...")

    app = FastAPI()

    logger.info("Application factory completed successfully.")
    return app