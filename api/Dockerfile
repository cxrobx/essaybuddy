FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download NLTK data
RUN python -c "import nltk; [nltk.download(c, quiet=True) for c in ['punkt_tab', 'averaged_perceptron_tagger', 'stopwords']]"

COPY . .

ENV DATA_ROOT=/data
EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
