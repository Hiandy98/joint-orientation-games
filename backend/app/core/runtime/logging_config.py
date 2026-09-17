import logging
import atexit, threading, sys

from pathlib import Path
from dataclasses import dataclass, asdict


@dataclass
class LoggerParameter:
    do_session_log: bool = True
    do_master_log: bool = False
    do_console_log: bool = False
    do_end_marking: bool = True
    do_start_marking: bool = True
    do_force_end_marking: bool = True
    is_colorful_console: bool = True
    add_init_info: bool = True
    formatter: str = '%(levelname)-8s (%(asctime)s): [%(filename)s] (Line: %(lineno)d) %(message)s'
    dateformatter: str = '%Y/%m/%d %H:%M:%S'
    master_log_maxbyte: int = 5 * 1024 * 1024
    master_log_maxbackup: int = 3
    logging_level: str = "INFO"
    log_dir: Path = Path("logs")
    
    # 用一個縮排看起來像卡片
    AI_instructions: str = """
        [PROJECT CONTEXT]
        No AI prompt word.
        """
    start_sep = """
==================================================
############### START NEW SESSION ################
==================================================
"""
    end_sep = """
- - - - - - - - - - - - - - - - - - - - - - - - -
~~~~~~~~~~~~~~~ PROGRAM TERMINATED ~~~~~~~~~~~~~~~
- - - - - - - - - - - - - - - - - - - - - - - - -
"""
    force_end_sep = """
* * * * * * * * * * * * * * * * * * * * * * * * *
!!!!!!!!!!!!!! FORCIBLY TERMINATED !!!!!!!!!!!!!!!
* * * * * * * * * * * * * * * * * * * * * * * * *
"""
    
    def __post_init__(self):
        # init時自動建立logs/
        self.log_dir.mkdir(parents=True, exist_ok=True)
        logging.raiseExceptions = True 


class ColoredFormatter(logging.Formatter):
    # 配色目的: 符合深色模式使用者
    COLORS_COMMON = {
        'DEBUG': '\033[3;38;2;120;120;120m',      # 鉛灰色(暗)
        'INFO': '\033[38;2;85;170;140m',       # 薄荷綠(暗)
        'WARNING': '\033[3;38;2;255;191;0m',     # 琥珀色(亮)
        'ERROR': '\033[38;2;255;50;50m',       # 亮紅色(亮)
        'CRITICAL': '\033[4;38m'  # 白色(高亮)
    }
    RESET_COLOR = '\033[0m'

    def format(self, record):
        # 繼承格式化的訊息
        colors = self.COLORS_COMMON
        message = super().format(record)
        color = colors.get(record.levelname, self.RESET_COLOR)
        return f"{color}{message}{self.RESET_COLOR}"



class Logger:
    # 避免線程衝突
    _lock = threading.Lock()
    _is_init: bool = False
    _is_end: bool = False

    @staticmethod
    def init(params: LoggerParameter):
        """一鍵初始化"""
        with Logger._lock:
            if Logger._is_init:
                return
            
            target_level = getattr(logging, params.logging_level.upper(), logging.INFO)
            
            root = logging.getLogger()
            root.setLevel(target_level)
            root.handlers.clear()

            loggers_to_capture = ["uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy.engine"]
            for name in loggers_to_capture:
                l = logging.getLogger(name)
                l.setLevel(target_level)
                l.handlers.clear()
                l.propagate = True

            # 統一所有模塊的Level
            for logger_name in logging.root.manager.loggerDict:
                sub_logger = logging.getLogger(logger_name)
                # 確保它是真正的 Logger 物件
                if isinstance(sub_logger, logging.Logger):
                    sub_logger.setLevel(target_level)
                    sub_logger.propagate = True

            # 掛載
            formatter = logging.Formatter(params.formatter, datefmt=params.dateformatter)

            
            formatter = logging.Formatter(params.formatter, datefmt=params.dateformatter)
            root = logging.getLogger()
            root.setLevel(getattr(logging, params.logging_level.upper(), logging.INFO))
            
            if root.hasHandlers():
                root.handlers.clear()

            if params.do_session_log:
                Logger._session_init(params, formatter, root)
                
            if params.do_master_log:
                Logger._master_init(params, formatter, root)
                
            if params.do_console_log:
                if params.is_colorful_console:
                    Logger._colorful_console_init(params, root)
                else:
                    Logger._console_init(formatter, root)
            
            if params.do_start_marking:
                logging.info(params.start_sep)

            if params.do_force_end_marking and not ("pytest" in sys.modules):
                sys.excepthook = lambda t, v, tb: Logger._handle_exception(params, t, v, tb)

            if params.do_end_marking:
                atexit.register(lambda: Logger._exit_test(params))

            # 在開頭加入傳入init的傳入參數資訊
            if params.add_init_info:
                ignore = ["AI_instructions", "start_sep", "end_sep", "force_end_sep"]
                logging.debug("--- [Logging Configs] ---")
                for key, value in asdict(params).items():
                    if key not in ignore:
                        logging.debug("%25s: %s", key, value)
                logging.debug("-------------------------")
        
            Logger._is_init = True
            logging.info("日誌系統已在線程保護下完成初始化。")


    @staticmethod
    def _session_init(params, formatter, root):
        """處理 AI 提示詞與 Session 分隔"""
        path = params.log_dir / "session.log"
        # "w"模式 重寫檔案
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\nCONTEXT FOR AI:\n{params.AI_instructions}\n{'='*60}\n\n")
        handler = logging.FileHandler(path, mode='a', encoding="utf-8")  # "a"模式 append logging
        handler.setFormatter(formatter)
        root.addHandler(handler)


    @staticmethod
    def _master_init(params, formatter, root):
        """建立檔案滾動紀錄"""
        from logging.handlers import RotatingFileHandler
        handler = RotatingFileHandler(
            params.log_dir / "master.log",
            maxBytes=params.master_log_maxbyte,
            backupCount=params.master_log_maxbackup,
            encoding="utf-8",
            delay=True
        )
        handler.setFormatter(formatter)
        root.addHandler(handler)


    @staticmethod
    def _colorful_console_init(params, root):
        """終端機彩色輸出"""
        console_formatter = ColoredFormatter(params.formatter, datefmt=params.dateformatter)
        console = logging.StreamHandler()
        console.setFormatter(console_formatter)
        root.addHandler(console)

    @staticmethod
    def _console_init(formatter, root):
        """終端機一般輸出"""
        console = logging.StreamHandler()
        console.setFormatter(formatter)
        root.addHandler(console)


    @staticmethod
    def _handle_exception(
        params: LoggerParameter, 
        exc_type, exc_value, exc_traceback):
        """處理未捕獲異常的靜態方法"""
        # 排除使用者手動中斷 (Ctrl+C)
        if exc_type == KeyboardInterrupt:
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        # 無控制台Logging時 依然會噴error 有Logging時則跟log混合
        if not params.do_console_log: sys.__excepthook__(exc_type, exc_value, exc_traceback)
        logging.critical("偵測到未處理的異常...", exc_info=(exc_type, exc_value, exc_traceback))
        logging.error("建議將內容或程式碼貼給AI分析")
        logging.info(params.force_end_sep)
        Logger._is_end = True  # 防二次結束


    @staticmethod
    def _exit_test(params):
        """自動檢測退出並添加logging"""
        if "pytest" in sys.modules or sys.stdout.closed:
            return

        if Logger._is_end: return
        logging.info(f"{params.end_sep}\n\n\n")
        Logger._is_end = True




#---------------------------------------------------------
#以下為測試傳入區塊
#---------------------------------------------------------

def main():
    breaking_test = True
    # init參數
    log_params = LoggerParameter(
        AI_instructions="""
        [PROJECT CONTEXT]
        Name: Logging_setter
        Goal: 能夠清晰的Logging
        """,
        logging_level="DEBUG",
        do_session_log= True,
        do_console_log= True,
        do_master_log = True,
        #is_colorful_console= False,
    )

    Logger.init(log_params)
    logging.debug("test")
    logging.info("test")
    logging.warning("test")
    logging.error("test")
    logging.critical("test")
    if breaking_test:
        #OwO
        #要用的時候刪註解
        pass

if __name__ == "__main__":
    main()