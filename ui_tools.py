#
# Screen tools: let the voice bot move the caller around the website while it talks.
#
# The LLM decides WHAT to show; the browser decides HOW (scroll, highlight, open,
# navigate) and answers with a short `hint` telling the LLM what to say next.
#
# Flow for one tool call:
#   LLM calls show_prices(item="home_5kw")
#   -> server sends {"type": "ui-tool", id, name, args} to the browser (RTVI server message)
#   -> web/tools.js runs the matching handler and replies with a "ui-tool-result" client message
#   -> server hands {"ok", "shown", "hint"} back to the LLM as the tool result
# If the browser doesn't answer within UI_TOOL_TIMEOUT_SECS the LLM gets a fallback
# hint and simply carries on talking, so a missing screen never stalls the call.
#
# Tool descriptions speak in the caller's terms and never mention pages, paths or URLs.
#

import asyncio
import uuid
from typing import Any

from loguru import logger

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.services.llm_service import FunctionCallParams

UI_TOOL_TIMEOUT_SECS = 4.0

FALLBACK_HINT = (
    "The screen didn't update. Don't mention the screen; just answer briefly by voice."
)


class UIBridge:
    """Sends UI tool calls to the browser and waits for the browser's result."""

    def __init__(self, rtvi: RTVIProcessor):
        self._rtvi = rtvi
        self._pending: dict[str, asyncio.Future] = {}

        @rtvi.event_handler("on_client_message")
        async def _on_client_message(_rtvi, message):
            if message.type != "ui-tool-result":
                return
            data = message.data or {}
            future = self._pending.pop(str(data.get("id", "")), None)
            if future and not future.done():
                future.set_result(data.get("result") or {})

    async def call(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        call_id = uuid.uuid4().hex
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[call_id] = future
        try:
            await self._rtvi.send_server_message(
                {"type": "ui-tool", "id": call_id, "name": name, "args": args or {}}
            )
            result = await asyncio.wait_for(future, timeout=UI_TOOL_TIMEOUT_SECS)
            logger.info(f"UI tool {name}({args}) -> {result.get('shown')}")
            return result
        except asyncio.TimeoutError:
            logger.warning(f"UI tool {name} got no answer from the browser")
            return {"ok": False, "hint": FALLBACK_HINT}
        except Exception as e:
            logger.warning(f"UI tool {name} failed: {e}")
            return {"ok": False, "hint": FALLBACK_HINT}
        finally:
            self._pending.pop(call_id, None)


def _enum(values: list[str], description: str) -> dict[str, Any]:
    return {"type": "string", "enum": values, "description": description}


# name -> (description, properties, required)
# Descriptions say WHEN to call, in the caller's words. No paths, no URLs.
UI_TOOL_SPECS: dict[str, tuple[str, dict[str, Any], list[str]]] = {
    "show_services": (
        "Show the company's services on the caller's screen. Call it when the caller asks "
        "what you offer or about one service: solar for homes, businesses or factories, "
        "solar water pumps for farms, solar water heaters, storage batteries, home EV "
        "chargers, panel maintenance, or the free site study.",
        {
            "service": _enum(
                [
                    "home_solar",
                    "business_solar",
                    "farm_water_pumps",
                    "solar_water_heaters",
                    "battery_storage",
                    "ev_chargers",
                    "maintenance",
                    "free_site_study",
                ],
                "The service the caller asked about. Leave it out to show all services.",
            )
        },
        [],
    ),
    "show_prices": (
        "Show prices on the caller's screen. Call it whenever you mention a price or the "
        "caller asks how much something costs.",
        {
            "item": _enum(
                [
                    "home_5kw",
                    "home_10kw",
                    "battery_5kwh",
                    "water_heater_200l",
                    "ev_charger",
                    "maintenance_visit",
                ],
                "The priced item. Leave it out to show the whole price list.",
            )
        },
        [],
    ),
    "show_payment_options": (
        "Show how the caller can pay. Call it when the caller asks about installments, "
        "paying monthly, the down payment, cash, card or bank transfer.",
        {
            "topic": _enum(
                ["methods", "installments", "down_payment"],
                "What the caller asked about. Leave it out to show everything about paying.",
            )
        },
        [],
    ),
    "show_warranty": (
        "Show the warranty on the caller's screen. Call it when the caller asks about the "
        "guarantee, warranty, how long a part lasts, or free maintenance after installing.",
        {
            "part": _enum(
                ["panels", "inverter", "batteries", "installation", "free_maintenance"],
                "The part the caller asked about. Leave it out to show all warranties.",
            )
        },
        [],
    ),
    "show_installation_steps": (
        "Show how the work goes, step by step. Call it when the caller asks how long "
        "installing takes, what happens after they agree, or about connecting to the "
        "electricity company.",
        {},
        [],
    ),
    "show_current_offers": (
        "Show the current offers. Call it when the caller asks about discounts, deals, "
        "promotions, or a discount for students or teachers.",
        {
            "offer": _enum(
                ["home_discount", "free_cleaning", "students_teachers"],
                "The offer the caller asked about. Leave it out to show all offers.",
            )
        },
        [],
    ),
    "show_branches": (
        "Show where the branches are and when they are open. Call it when the caller asks "
        "where you are, about a city's branch, the address, or opening hours.",
        {
            "branch": _enum(
                ["amman", "irbid", "aqaba"],
                "The branch the caller asked about. Leave it out to show all branches.",
            )
        },
        [],
    ),
    "show_contact_info": (
        "Show the phone, WhatsApp and email. Call it when the caller wants to call, "
        "message or email the company, or when you suggest they contact the team.",
        {},
        [],
    ),
    "show_common_answer": (
        "Open a common question on the screen. Call it when the caller asks how much "
        "they'll save on the bill, how long until the system pays for itself, whether it "
        "works in winter or on cloudy days, whether panels need cleaning, or whether you "
        "work outside Amman.",
        {
            "topic": _enum(
                ["savings", "payback", "winter", "cleaning", "coverage"],
                "Which common question the caller asked.",
            )
        },
        ["topic"],
    ),
    "show_about_company": (
        "Show who the company is and what it has achieved. Call it when the caller asks "
        "about the company, how long you've been working, how many systems you've "
        "installed, or who runs it.",
        {},
        [],
    ),
    "go_to_home": (
        "Bring the caller back to the start of the website. Call it when the caller wants "
        "to start over or go back to the beginning.",
        {},
        [],
    ),
    "book_site_visit": (
        "Fill in the free site-visit request on the caller's screen. Call it when the "
        "caller wants a visit, an engineer to come, a quote, or the free study. Ask for "
        "their name and city first if you don't know them.",
        {
            "name": {"type": "string", "description": "The caller's name, as they said it."},
            "city": {"type": "string", "description": "The city or area for the visit."},
            "system_type": _enum(
                ["home", "business", "farm", "not_sure"],
                "Where the system is for.",
            ),
            "phone": {
                "type": "string",
                "description": "The caller's phone number, only if they said it.",
            },
        },
        ["name", "city"],
    ),
}


def build_ui_tools(bridge: UIBridge) -> list[FunctionSchema]:
    """FunctionSchemas whose handlers forward the call to the browser."""

    def make_handler(tool_name: str):
        async def handler(params: FunctionCallParams):
            result = await bridge.call(tool_name, dict(params.arguments or {}))
            await params.result_callback(result)

        return handler

    return [
        FunctionSchema(
            name=name,
            description=description,
            properties=properties,
            required=required,
            handler=make_handler(name),
        )
        for name, (description, properties, required) in UI_TOOL_SPECS.items()
    ]
