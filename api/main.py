import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.sandbox import set_data_root
from routers import essays, samples, profiles, ai, ai_detection, books, evidence, research, web_sources

DATA_ROOT = os.environ.get("DATA_ROOT", "../data")
API_PORT = int(os.environ.get("API_PORT", 8002))

set_data_root(DATA_ROOT)

app = FastAPI(title="EssayBuddy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(essays.router)
app.include_router(samples.router)
app.include_router(profiles.router)
app.include_router(ai.router)
app.include_router(ai_detection.router)
app.include_router(books.router)
app.include_router(evidence.router)
app.include_router(research.router)
app.include_router(web_sources.router)


@app.on_event("startup")
async def ensure_nltk_data():
    import nltk
    for corpus in ["punkt_tab", "averaged_perceptron_tagger", "stopwords"]:
        nltk.download(corpus, quiet=True)


@app.get("/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=API_PORT, reload=True)
