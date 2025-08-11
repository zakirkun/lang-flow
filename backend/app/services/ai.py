from __future__ import annotations

import os
from typing import Dict, Optional

from langchain_openai import ChatOpenAI


def render_prompt(template: str, context: Dict) -> str:
    try:
        return template.format(**context)
    except Exception:
        # Fall back to raw template if formatting fails
        return template


def get_openai_client(model_name: str, api_key: Optional[str] = None) -> ChatOpenAI:
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return ChatOpenAI(model=model_name, api_key=key, temperature=0)


def run_ai_completion(prompt: str, model_name: str, api_key: Optional[str] = None) -> str:
    llm = get_openai_client(model_name=model_name, api_key=api_key)
    msg = llm.invoke(prompt)
    # LangChain returns an AIMessage object; convert to string
    return getattr(msg, "content", str(msg)) 