"""NLP-based writing style analysis."""
import re
import string
from collections import Counter

import nltk
import textstat


def analyze_style(text: str) -> dict:
    """Compute quantitative style metrics from text."""
    sentences = nltk.sent_tokenize(text)
    words = nltk.word_tokenize(text)
    words_lower = [w.lower() for w in words if w.isalpha()]

    stop_words = set(nltk.corpus.stopwords.words("english"))
    content_words = [w for w in words_lower if w not in stop_words]

    # Sentence length stats
    sent_lengths = [len(nltk.word_tokenize(s)) for s in sentences]
    avg_sent_len = sum(sent_lengths) / max(len(sent_lengths), 1)
    stddev_sent_len = (
        (sum((l - avg_sent_len) ** 2 for l in sent_lengths) / max(len(sent_lengths), 1)) ** 0.5
        if sent_lengths else 0
    )

    # Paragraph analysis
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    sents_per_para = [len(nltk.sent_tokenize(p)) for p in paragraphs]
    avg_sents_per_para = sum(sents_per_para) / max(len(sents_per_para), 1)

    # Vocabulary richness (type-token ratio)
    ttr = len(set(words_lower)) / max(len(words_lower), 1)

    # Top words (excluding stopwords)
    word_freq = Counter(content_words)
    top_words = word_freq.most_common(50)

    # Transition words
    transitions = [
        "however", "therefore", "moreover", "furthermore", "nevertheless",
        "consequently", "meanwhile", "additionally", "similarly", "conversely",
        "nonetheless", "thus", "hence", "accordingly", "likewise",
        "in contrast", "on the other hand", "for example", "in addition",
        "as a result", "in conclusion", "in fact", "in particular",
    ]
    text_lower = text.lower()
    transition_counts = {}
    for t in transitions:
        count = text_lower.count(t)
        if count > 0:
            transition_counts[t] = count

    # Punctuation patterns (per 1000 words)
    word_count = max(len(words), 1)
    punct_per_1k = {
        "semicolons": text.count(";") / word_count * 1000,
        "em_dashes": (text.count("\u2014") + text.count("--")) / word_count * 1000,
        "parentheticals": text.count("(") / word_count * 1000,
        "exclamations": text.count("!") / word_count * 1000,
        "questions": text.count("?") / word_count * 1000,
    }

    # Readability metrics
    formality_score = textstat.flesch_reading_ease(text)
    avg_syllables = textstat.avg_syllables_per_word(text)

    # Active vs passive voice (simple heuristic)
    passive_patterns = re.findall(
        r'\b(?:is|are|was|were|been|being|be)\s+\w+ed\b', text, re.IGNORECASE
    )
    passive_count = len(passive_patterns)
    active_ratio = 1 - (passive_count / max(len(sentences), 1))

    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "paragraph_count": len(paragraphs),
        "avg_sentence_length": round(avg_sent_len, 1),
        "stddev_sentence_length": round(stddev_sent_len, 1),
        "min_sentence_length": min(sent_lengths) if sent_lengths else 0,
        "max_sentence_length": max(sent_lengths) if sent_lengths else 0,
        "avg_sentences_per_paragraph": round(avg_sents_per_para, 1),
        "type_token_ratio": round(ttr, 3),
        "top_words": top_words,
        "transition_words": transition_counts,
        "punctuation_per_1k": {k: round(v, 2) for k, v in punct_per_1k.items()},
        "flesch_reading_ease": round(formality_score, 1),
        "avg_syllables_per_word": round(avg_syllables, 2),
        "active_voice_ratio": round(active_ratio, 2),
    }
