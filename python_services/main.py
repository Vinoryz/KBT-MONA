import re
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from chroma_connection import get_chroma_collection


class QueryRequest(BaseModel):
    question: str
    n_results: Optional[int] = 3


class QueryResponse(BaseModel):
    status: str
    question: str
    content: str


app = FastAPI(title="Mona RAG Engine")


@app.post("/api/rag-query", response_model=QueryResponse)
async def query_documents(
    payload: QueryRequest,
    collection=Depends(get_chroma_collection)
):
    try:

        results = collection.query(
            query_texts=[payload.question],
            n_results=payload.n_results
        )

        if not results['documents']:
            return QueryResponse(
                status="error",
                question=payload.question,
                context="Tidak ada data ditemukan."
            )

        documents = results["documents"][0]
        text = " ".join(documents)
        text = text.replace("\n", " ")
        text = re.sub(r"[^A-Za-z0-9\s\.\,\;\:\'\"\-\(\)]", "", text)
        text = " ".join(text.split())

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

    full_prompt = f"""
    You are a helpful assistant. Answer the user question based ONLY on the context provided below.
    If the answer is not in the context, say "I don't know".
    
    Context:
    {text}

    Question:
    {payload.question}
    """

    return QueryResponse(
        status="success",
        question=payload.question,
        content=full_prompt
    )
