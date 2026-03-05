"""Writing style profile endpoints."""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox import data_root, atomic_write
from services.style_analyzer import analyze_style
from services.ai_provider import get_provider

router = APIRouter(prefix="/profiles", tags=["profiles"])


class AnalyzeRequest(BaseModel):
    sample_ids: List[str]
    name: Optional[str] = None


class CreateVoiceRequest(BaseModel):
    sample_ids: List[str]
    name: str


class VoiceModelRequest(BaseModel):
    voice_profile: dict
    voice_examples: List[dict]
    model_used: Optional[str] = "claude-opus-4-6"


def _profiles_dir() -> Path:
    return data_root() / "profiles"


def _samples_dir() -> Path:
    return data_root() / "samples"


@router.post("/analyze", status_code=201)
async def analyze_samples(body: AnalyzeRequest):
    if not body.sample_ids:
        raise HTTPException(status_code=422, detail="At least one sample_id required")

    texts = []
    for sid in body.sample_ids:
        path = _samples_dir() / f"{sid}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Sample {sid} not found")
        sample = json.loads(path.read_text(encoding="utf-8"))
        texts.append(sample["text"])

    combined = "\n\n".join(texts)
    profile_data = analyze_style(combined)

    profile_id = str(uuid.uuid4())[:8]
    profile = {
        "id": profile_id,
        "name": body.name or f"Profile {profile_id}",
        "sample_ids": body.sample_ids,
        "metrics": profile_data,
        "created_at": datetime.utcnow().isoformat(),
    }

    path = _profiles_dir() / f"{profile_id}.json"
    atomic_write(path, json.dumps(profile, indent=2))
    return profile


VOICE_MODEL_PROMPT = """Analyze the following writing samples and produce a detailed voice profile.

<writing-samples>
{samples_text}
</writing-samples>

Return a JSON object with exactly this structure:
{{
  "voice_profile": {{
    "summary": "2-3 sentence overview of the writer's voice",
    "tone": "description of tone and emotional register",
    "sentence_patterns": "characteristic sentence structures and rhythms",
    "argument_style": "how arguments are built and evidence is presented",
    "vocabulary_level": "vocabulary range and distinctive word choices",
    "rhetorical_devices": ["device 1 with example", "device 2 with example"],
    "distinctive_phrases": ["phrase 1", "phrase 2"],
    "transition_patterns": "how the writer transitions between ideas",
    "paragraph_structure": "typical paragraph organization",
    "what_to_avoid": "what NOT to do when mimicking this voice"
  }},
  "voice_examples": [
    {{
      "excerpt": "verbatim passage from the samples (100-300 words)",
      "demonstrates": "what this excerpt shows about the voice"
    }}
  ]
}}

Include 3-5 voice_examples chosen as the most representative passages.
Return ONLY the JSON object, no other text."""

MAX_CHARS_PER_SAMPLE = 8000


@router.post("/create-voice", status_code=201)
async def create_voice_profile(body: CreateVoiceRequest):
    if not body.sample_ids:
        raise HTTPException(status_code=422, detail="At least one sample_id required")
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Profile name is required")

    # Load sample texts
    texts = []
    for sid in body.sample_ids:
        path = _samples_dir() / f"{sid}.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Sample {sid} not found")
        sample = json.loads(path.read_text(encoding="utf-8"))
        text = sample["text"][:MAX_CHARS_PER_SAMPLE]
        texts.append(text)

    combined = "\n\n---\n\n".join(texts)

    # Run quantitative analysis
    profile_data = analyze_style(combined)

    # Generate voice model via AI
    prompt = VOICE_MODEL_PROMPT.format(samples_text=combined)
    try:
        provider = get_provider()
        raw_response = await provider.generate(prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider failed: {str(e)}")

    # Parse AI response as JSON
    try:
        voice_data = json.loads(raw_response)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON. Raw output: {raw_response[:500]}"
        )

    # Validate expected keys
    if "voice_profile" not in voice_data or "voice_examples" not in voice_data:
        raise HTTPException(
            status_code=502,
            detail=f"AI response missing required keys. Got: {list(voice_data.keys())}"
        )

    # Build and save profile
    profile_id = str(uuid.uuid4())[:8]
    profile = {
        "id": profile_id,
        "name": body.name.strip(),
        "sample_ids": body.sample_ids,
        "metrics": profile_data,
        "voice_model": {
            "voice_profile": voice_data["voice_profile"],
            "voice_examples": voice_data["voice_examples"],
            "generated_at": datetime.utcnow().isoformat(),
            "model_used": provider.name(),
        },
        "created_at": datetime.utcnow().isoformat(),
    }

    path = _profiles_dir() / f"{profile_id}.json"
    atomic_write(path, json.dumps(profile, indent=2))
    return profile


@router.get("/{profile_id}")
async def get_profile(profile_id: str):
    path = _profiles_dir() / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("")
async def list_profiles():
    profiles = []
    for f in sorted(_profiles_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            profiles.append({
                "id": data["id"],
                "name": data.get("name", "Unnamed"),
                "sample_ids": data.get("sample_ids", []),
                "created_at": data.get("created_at"),
                "bundled": data.get("bundled", False),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return profiles


@router.post("/{profile_id}/voice-model", status_code=200)
async def set_voice_model(profile_id: str, body: VoiceModelRequest):
    path = _profiles_dir() / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = json.loads(path.read_text(encoding="utf-8"))
    profile["voice_model"] = {
        "voice_profile": body.voice_profile,
        "voice_examples": body.voice_examples,
        "generated_at": datetime.utcnow().isoformat(),
        "model_used": body.model_used,
    }
    atomic_write(path, json.dumps(profile, indent=2))
    return profile


@router.delete("/{profile_id}/voice-model", status_code=200)
async def delete_voice_model(profile_id: str):
    path = _profiles_dir() / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = json.loads(path.read_text(encoding="utf-8"))
    profile.pop("voice_model", None)
    atomic_write(path, json.dumps(profile, indent=2))
    return profile
