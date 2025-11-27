import os
import json
import hashlib
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from jose import jwt
import requests
from google.auth import jwt as google_jwt

from google import genai
from google.genai import types
from google.cloud import storage, firestore

# ---------------------------------------------------------
# FastAPI app + CORS
# ---------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Environment / Config
# ---------------------------------------------------------
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "pothole-webapp")

FIRESTORE_DB_ID = os.getenv("FIRESTORE_DB_ID", "potholedb")

POTHOLE_BUCKET = os.getenv("POTHOLE_BUCKET", "pothole-images-sriram")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "pothole-webapp")

# Firebase public certs URL
GOOGLE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
)

# ---------------------------------------------------------
# Firestore + Storage clients
# ---------------------------------------------------------
db = firestore.Client(project=PROJECT_ID, database=FIRESTORE_DB_ID)

storage_client = storage.Client()
bucket = storage_client.bucket(POTHOLE_BUCKET)

# ---------------------------------------------------------
# Helper: compute MD5 hash
# ---------------------------------------------------------
def md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


# ---------------------------------------------------------
# Firebase Token Verification
# ---------------------------------------------------------
def verify_firebase_token(token: str):
    """Validate Firebase ID token using Google public keys."""
    try:
        certs = requests.get(GOOGLE_CERTS_URL).json()
        header = jwt.get_unverified_header(token)
        kid = header["kid"]

        if kid not in certs:
            print("❌ Invalid key ID")
            return None

        public_key = certs[kid]
        decoded = google_jwt.decode(
            token,
            public_key,
            audience=FIREBASE_PROJECT_ID,
        )
        return decoded

    except Exception as e:
        print("Token verification error:", e)
        return None


# ---------------------------------------------------------
# Gemini client factory
# ---------------------------------------------------------
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment.")
    return genai.Client(api_key=api_key)

def generate_tracking_id():
    """
    Human-readable tracking ID format:
    PTH-YYYYMMDD-XXXXXX
    where XXXXXX is a zero-padded counter.
    """
    date_part = datetime.utcnow().strftime("%Y%m%d")

    # Increment counter stored in Firestore system collection
    counter_ref = db.collection("system").document("tracking_counter")
    counter_doc = counter_ref.get()

    if not counter_doc.exists:
        counter_ref.set({"value": 1})
        counter = 1
    else:
        counter = counter_doc.to_dict().get("value", 1) + 1
        counter_ref.update({"value": counter})

    return f"PTH-{date_part}-{str(counter).zfill(6)}"


# ---------------------------------------------------------
# API: POST /analyze  — MULTI-IMAGE + AUTH
# ---------------------------------------------------------
@app.post("/analyze")
async def analyze(
    request: Request,
    images: list[UploadFile] = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    try:
        # ----------------------------------------------------
        # AUTHENTICATION CHECK
        # ----------------------------------------------------
        id_token = request.headers.get("x-user-token")
        if not id_token:
            raise HTTPException(status_code=401, detail="Missing token")

        decoded = verify_firebase_token(id_token)

        if not decoded:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = decoded.get("user_id")
        email = decoded.get("email")

        # ----------------------------------------------------
        # Process multiple images
        # ----------------------------------------------------
        client = get_gemini_client()
        results = []

        for image in images:
            img_bytes = await image.read()

            # Compute MD5 hash
            image_hash = md5_bytes(img_bytes)

            # Firestore dedupe
            doc_ref = db.collection("pothole_reports").document(image_hash)
            snapshot = doc_ref.get()

            if snapshot.exists:
                existing = snapshot.to_dict()
                # ensure dedupe flag is added
                existing["deduped"] = True

                # DO NOT modify:
                # - existing["tracking_id"]
                # - existing["status"]
                # - existing["user_id"]
                # - existing["email"]
                # - existing["created_at"]

                # Return existing record to frontend
                results.append(existing)
                continue

            # Determine file extension
            _, ext = os.path.splitext(image.filename or "")
            if not ext:
                ext = ".jpg"

            blob_name = f"pothole_{latitude}_{longitude}_{image_hash}{ext}"
            blob = bucket.blob(blob_name)
            blob.upload_from_string(img_bytes, content_type=image.content_type)

            gcs_uri = f"gs://{POTHOLE_BUCKET}/{blob_name}"

            # Gemini prompt
            prompt_text = f"""
You are a pothole assessment expert. Analyze the road image and return ONLY JSON:
{{
  "type": "pothole" | "crack" | "rutting" | "no_damage",
  "severity": 1-5,
  "urgency": "low" | "medium" | "high",
  "explanation": "short sentence",
  "gps": "{latitude}, {longitude}"
}}
"""

            image_part = types.Part.from_bytes(
                data=img_bytes, mime_type=image.content_type
            )

            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[prompt_text, image_part],
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        response_mime_type="application/json",
                    ),
                )
            except Exception as api_err:
                return JSONResponse(
                    status_code=502,
                    content={"error": f"Gemini API error: {api_err}"},
                )

            # Parse JSON
            try:
                analysis = json.loads(response.text)

                # Sometimes Gemini returns a list → take first element
                if isinstance(analysis, list) and len(analysis) > 0:
                    analysis = analysis[0]

            except Exception:
                analysis = {"raw": response.text}

            tracking_id = generate_tracking_id()

            # Build Firestore record
            record = {
                "type": analysis.get("type"),
                "severity": analysis.get("severity"),
                "urgency": analysis.get("urgency"),
                "explanation": analysis.get("explanation"),
                "gps": analysis.get("gps") or f"{latitude}, {longitude}",
                "latitude": latitude,
                "longitude": longitude,
                "image": gcs_uri,
                "image_hash": image_hash,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "user_id": user_id,
                "email": email,
                "deduped": False ,
                "tracking_id": tracking_id ,
                "status": "submitted"  # initial state

            }

            # Save to Firestore
            try:
                doc_ref.set(record)
            except Exception as db_err:
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Firestore write failed: {db_err}"},
                )

            results.append(record)

        # Return all results
        return {"results": results}

    except HTTPException:
        raise

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"SERVER ERROR: {e}"},
        )

@app.get("/status/{tracking_id}")
def status_lookup(tracking_id: str, request: Request):
    try:
        # AUTH CHECK
        id_token = request.headers.get("x-user-token")
        if not id_token:
            raise HTTPException(status_code=401, detail="Missing token")

        decoded = verify_firebase_token(id_token)
        if not decoded:
            raise HTTPException(status_code=401, detail="Invalid token")

        # SEARCH Firestore
        reports = db.collection("pothole_reports") \
                    .where("tracking_id", "==", tracking_id) \
                    .get()

        if not reports:
            raise HTTPException(status_code=404, detail="Tracking ID not found")

        record = reports[0].to_dict()
        record["found"] = True

        return record

    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"SERVER ERROR: {e}"}
        )

@app.get("/myreports")
def my_reports(request: Request):
    try:
        print("=== /myreports CALLED ===")

        # AUTH
        id_token = request.headers.get("x-user-token")
        print("X-USER-TOKEN HEADER:", id_token)

        if not id_token:
            raise HTTPException(status_code=401, detail="Missing token")

        print("ID TOKEN:", id_token[:20], "...")

        decoded = verify_firebase_token(id_token)
        print("DECODED TOKEN:", decoded)

        if not decoded:
            print("ERROR: Invalid token")
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = decoded.get("user_id") or decoded.get("uid")
        print("USER ID:", user_id)

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid Firebase token (no user_id/uid)")

        # Query Firestore
        print("QUERYING FIRESTORE ...")

        docs = (
            db.collection("pothole_reports")
            .where("user_id", "==", user_id)
            .get()
        )

        print("FIRESTORE DOC COUNT:", len(docs))

        results = [d.to_dict() for d in docs]

        print("RETURNING RESULTS", results)

        return {"reports": results}

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 INTERNAL ERROR:", e)
        return JSONResponse(
            status_code=500,
            content={"error": f"SERVER ERROR: {str(e)}"}
        )
