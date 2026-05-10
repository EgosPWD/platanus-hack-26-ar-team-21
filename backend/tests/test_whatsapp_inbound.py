from app.services.whatsapp_inbound import _parse_deterministic, parse_evolution_message


def test_parse_evolution_message_from_key_and_conversation():
    payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "remoteJid": "5493510000000@s.whatsapp.net",
                "fromMe": False,
                "id": "ABC123",
            },
            "message": {"conversation": "aprobar"},
        },
    }

    incoming = parse_evolution_message(payload)

    assert incoming is not None
    assert incoming.phone == "5493510000000"
    assert incoming.text == "aprobar"
    assert incoming.message_id == "ABC123"


def test_parse_evolution_message_ignores_own_messages():
    payload = {
        "data": {
            "key": {
                "remoteJid": "5493510000000@s.whatsapp.net",
                "fromMe": True,
            },
            "message": {"conversation": "aprobar"},
        },
    }

    assert parse_evolution_message(payload) is None


def test_parse_deterministic_approve():
    intent = _parse_deterministic("sí")

    assert intent.action == "approve"
    assert intent.changes == {}


def test_parse_deterministic_reject():
    intent = _parse_deterministic("rechazar")

    assert intent.action == "reject"
    assert intent.changes == {}


def test_parse_deterministic_budget_and_copy_changes():
    intent = _parse_deterministic(
        "presupuesto 15000\ncopy: Nueva promo con envío gratis"
    )

    assert intent.action == "modify"
    assert intent.changes == {
        "suggested_budget_ars": 15000,
        "copy_es": "Nueva promo con envío gratis",
    }
