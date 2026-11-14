from .base import BaseScraper
from .fotocasa import FotocasaScraper
from .habitaclia import HabitacliaScraper
from .housinganywhere import HousingAnywhereScraper
from .idealista import IdealistaScraper
from .milanuncios import MilanunciosScraper
from .pisos import PisosScraper
from .spotahome import SpotahomeScraper
from .yaencontre import YaencontreScraper

SCRAPERS: dict[str, BaseScraper] = {
    s.portal: s
    for s in (
        IdealistaScraper(), FotocasaScraper(), HabitacliaScraper(), PisosScraper(),
        YaencontreScraper(), MilanunciosScraper(), SpotahomeScraper(), HousingAnywhereScraper(),
    )
}
