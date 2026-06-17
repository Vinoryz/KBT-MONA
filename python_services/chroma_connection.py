import chromadb
from chromadb.api import ClientAPI
from chromadb.api.models.Collection import Collection
from chromadb.utils import embedding_functions
from fastapi import Depends
from dotenv import load_dotenv
import os

load_dotenv()

_client: ClientAPI | None = None
_collection: Collection | None = None


def get_chroma_client() -> ClientAPI:
    global _client
    if _client is None:
        # Menyimpan database secara lokal di folder 'chroma_db'
        _client = chromadb.PersistentClient(path="./chroma_db")
    return _client



def get_chroma_collection(client: ClientAPI = Depends(get_chroma_client)) -> Collection:
    global _collection
    if _collection is None:
        default_ef = embedding_functions.DefaultEmbeddingFunction()
        _collection = client.get_or_create_collection(
            name="mona_rag_knowledge",
            embedding_function=default_ef,
        )
    return _collection
