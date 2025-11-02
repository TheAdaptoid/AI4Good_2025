import asyncio, os, json, argparse
from dataclasses import dataclass
from typing import List, Dict, Any
from dotenv import load_dotenv

import semantic_kernel as sk
from semantic_kernel.connectors.ai.prompt_execution_settings import PromptExecutionSettings
from semantic_kernel.connectors.ai.open_ai.services.open_ai_chat_completion import OpenAIChatCompletion

from tools.library import LibraryContext  # your RAG helper (context-only)

load_dotenv()

@dataclass
class BotConfig:
    model: str = os.getenv("OPENAI_MODEL", "gpt-4")
    temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))
    max_tokens: int = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
    api_key: str = os.getenv("OPENAI_API_KEY", "")
    vector_store_id: str = os.getenv("OPENAI_VECTOR_STORE_ID", "")
    rag_model: str = os.getenv("OPENAI_RAG_MODEL", "gpt-4o-mini")
    system_prompt: str = os.getenv(
        "SYSTEM_PROMPT",
        "You are a helpful, concise assistant. Use provided context to ground your answers. Do not invent facts; use the library tool to back responses."
    )

class StatelessSKBot:
    def __init__(self, cfg: BotConfig):
        self.cfg = cfg
        os.environ["OPENAI_API_KEY"] = cfg.api_key

        self.kernel = sk.Kernel()
        service = OpenAIChatCompletion(
            service_id="chat",
            ai_model_id=cfg.model,
            api_key=cfg.api_key
        )
        self.kernel.add_service(service)

        self.exec_settings = PromptExecutionSettings(
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
        )

        # RAG helper (context only; no files returned)
        self.library = LibraryContext(
            vector_store_id=cfg.vector_store_id,
            api_key=cfg.api_key,
            model=cfg.rag_model
        )

    def _answer_prompt(self, prompts: List[str], data: Dict[str, Any], context: str) -> str:
        sys = self.cfg.system_prompt.strip()
        prompts_block = "\n".join(f"- {p}" for p in prompts) if prompts else "(none)"
        data_block = json.dumps(data, indent=2, ensure_ascii=False) if data else "{}"
        ctx_block = context if context else "(no retrieved context)"

        return f"""{sys}

Retrieved context (for grounding; do not quote verbatim):
{ctx_block}

Given:
Prompts:
{prompts_block}

Relevant data (JSON):
{data_block}

Instruction:
Write a concise, direct answer grounded in the retrieved context and provided data.
If context is not relevant, rely on the data.
Do NOT include file names, file IDs, or raw document dumps.

Answer:"""

    async def handle_request(self, prompts: List[str], data: Dict[str, Any]) -> str:
        joined_query = "\n".join(prompts) + ("\n" + json.dumps(data, ensure_ascii=False) if data else "")
        context = self.library.retrieve(joined_query)

        prompt = self._answer_prompt(prompts, data, context)
        result = await self.kernel.invoke_prompt(
            prompt=prompt,
            execution_settings=self.exec_settings,
        )
        return str(result)


# ---------------- CLI / REPL ----------------
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Stateless SK bot (RAG-grounded)")
    p.add_argument("prompts", nargs="*", help="Prompt(s). Provide one or many.")
    p.add_argument("--data", default="{}", help="JSON dict with extra data (e.g., --data '{\"region\":\"FL\"}')")
    return p.parse_args()

async def main():
    args = parse_args()
    bot = StatelessSKBot(BotConfig())

    # If prompts passed on CLI → one-shot
    if args.prompts:
        data = json.loads(args.data)
        ans = await bot.handle_request(args.prompts, data)
        print(ans)
        return

    # Otherwise start a simple REPL
    print("RAG bot REPL. Press Enter on an empty line to exit.")
    while True:
        q = input("You: ").strip()
        if not q:
            break
        # In REPL we accept optional JSON after a separator e.g.:
        #   question ::: {"region":"FL"}
        if "::: " in q:
            msg, data_raw = q.split("::: ", 1)
            data = json.loads(data_raw)
            prompts = [msg]
        else:
            prompts = [q]
            data = {}
        ans = await bot.handle_request(prompts, data)
        print(f"Bot: {ans}\n")

if __name__ == "__main__":
    asyncio.run(main())