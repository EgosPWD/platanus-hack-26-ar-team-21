from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "whatsapp_mock" in payload
    assert payload["whatsapp"]["api_key_configured"] is False
    assert payload["whatsapp"]["connected"] is False
