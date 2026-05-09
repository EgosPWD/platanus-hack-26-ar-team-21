"""Publisher mock — usa MetaAdsClient mock pero la lógica de DB es la misma.

Para mantener la simetría con `meta.py`, simplemente reusa MetaPublisher
inyectándole el cliente mock. Lo dejamos en archivo aparte por si en el
futuro queremos divergir (ej: mock con random delays para demos).
"""
from __future__ import annotations

from app.publishers.meta import MetaPublisher


class MetaMockPublisher(MetaPublisher):
    publisher_name = "meta_mock"


__all__ = ["MetaMockPublisher"]
