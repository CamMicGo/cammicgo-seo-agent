#!/usr/bin/env python3
"""Read-only prototype for public YouTube transcripts. No Google API key required.
Install: python -m pip install "youtube-transcript-api>=1.2,<2"
Run: python scripts/test_youtube_transcript.py Lxkb4gd041I --language en
"""
import argparse
import json
import re
import sys
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import YouTubeTranscriptApi

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

def video_id(value: str) -> str:
    if VIDEO_ID.fullmatch(value):
        return value
    url = urlparse(value)
    if url.hostname in ("youtube.com", "www.youtube.com", "m.youtube.com"):
        value = parse_qs(url.query).get("v", [""])[0]
    elif url.hostname == "youtu.be":
        value = url.path.strip("/")
    if not VIDEO_ID.fullmatch(value):
        raise ValueError("Expected a YouTube video ID or URL")
    return value

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()
    try:
        vid = video_id(args.video)
        transcript = YouTubeTranscriptApi().fetch(vid, languages=[args.language])
        segments = [{"start": s.start, "duration": s.duration, "text": s.text} for s in transcript]
        print(json.dumps({"videoId": vid, "language": transcript.language_code,
            "isGenerated": transcript.is_generated, "segments": segments}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": type(exc).__name__, "message": str(exc)[:1000]}), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
