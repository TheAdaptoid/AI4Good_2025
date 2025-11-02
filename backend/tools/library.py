# tools/library.py
import os, time
from typing import Optional
from openai import OpenAI

class LibraryContext:
    def __init__(self, vector_store_id: str, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.vector_store_id = vector_store_id
        self.model = model

        self.assistant = self.client.beta.assistants.create(
            name="Library Context Assistant",
            model=self.model,
            tools=[{"type": "file_search"}],
            tool_resources={"file_search": {"vector_store_ids": [self.vector_store_id]}},
            instructions=(
                "Provide a brief factual context from the attached knowledge base. "
                "Do not include file names, IDs, links, or citations."
            ),
        )

    def retrieve(self, query: str) -> str:
        prompt = (
            "Summarize the most relevant facts for this query using the document store. "
            "Return a short, neutral grounding paragraph. No file names/IDs/links.\n\n"
            f"Query:\n{query}\n"
        )
        thread = self.client.beta.threads.create()
        self.client.beta.threads.messages.create(thread_id=thread.id, role="user", content=prompt)
        run = self.client.beta.threads.runs.create(thread_id=thread.id, assistant_id=self.assistant.id)

        status = run.status
        while status in ("queued", "in_progress", "requires_action"):
            time.sleep(0.5)
            run = self.client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
            status = run.status

        messages = self.client.beta.threads.messages.list(thread_id=thread.id, order="desc", limit=5)
        for m in messages.data:
            if m.role == "assistant":
                parts = [p.text.value for p in m.content if p.type == "text"]
                if parts:
                    return parts[0].strip()
        return ""
