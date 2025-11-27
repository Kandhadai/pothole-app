import React, { useState } from "react";
import "./App.css";

import Login from "./Login";
import { auth } from "./firebase";

function App() {
  const [user, setUser] = useState(null);

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [gps, setGPS] = useState(null);
  const [loading, setLoading] = useState(false);

  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [showCheckStatus, setShowCheckStatus] = useState(false);
  const [showMyReports, setShowMyReports] = useState(false);

  const [checkID, setCheckID] = useState("");
  const [statusResult, setStatusResult] = useState(null);
  const [myReports, setMyReports] = useState([]);

  const BASE_URL = "https://pothole-backend-117334135242.us-central1.run.app";
  const BACKEND_ANALYZE = `${BASE_URL}/analyze`;
  const BACKEND_STATUS = `${BASE_URL}/status`;
  const BACKEND_MYREPORTS = `${BASE_URL}/myreports`;

  // ------------------------------------------------------------
  // Helper: Always get a valid Firebase token
  // ------------------------------------------------------------
  async function getValidToken() {
    const current = auth.currentUser;
    if (!current) {
      alert("Your login session expired. Please log in again.");
      window.location.reload();
      return null;
    }

    try {
      return await current.getIdToken(true); // FORCE refresh
    } catch (err) {
      console.error("Token refresh error:", err);
      alert("Authentication failed. Please log in again.");
      window.location.reload();
      return null;
    }
  }

  // ------------------------------------------------------------
  // LOGIN PAGE
  // ------------------------------------------------------------
  if (!user) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <h1>Pothole Analyzer</h1>
        <Login onLogin={setUser} />
        <p>Please sign in with Google.</p>
      </div>
    );
  }

  // ------------------------------------------------------------
  // SUCCESS PAGE
  // ------------------------------------------------------------
  if (showSuccess) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <h1>Submission Successful 🎉</h1>

        <h2>Your Tracking Details</h2>

        {results.map((res, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 20,
              padding: 20,
              background: "#f8f8f8",
              borderRadius: 10,
              border: "1px solid #ddd",
              maxWidth: 400,
            }}
          >
            <p><strong>Tracking ID:</strong> {res.tracking_id}</p>
            <p><strong>Status:</strong> {res.status}</p>
            <p><strong>Type:</strong> {res.type}</p>
            <p><strong>Severity:</strong> {res.severity}</p>
            <p><strong>Urgency:</strong> {res.urgency}</p>
            <p><strong>Explanation:</strong> {res.explanation}</p>
          </div>
        ))}

        <button
          onClick={() => {
            setShowSuccess(false);
            setResults([]);
            setImages([]);
            setPreviews([]);
            setGPS(null);
          }}
          style={{
            padding: "10px 20px",
            background: "#007bff",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            marginTop: 20,
          }}
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------
  // CHECK STATUS PAGE
  // ------------------------------------------------------------
  if (showCheckStatus) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <h1>Check Report Status</h1>

        <input
          type="text"
          placeholder="Enter Tracking ID"
          value={checkID}
          onChange={(e) => setCheckID(e.target.value)}
          style={{
            width: "300px",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />

        <button
          onClick={lookupStatus}
          style={{
            padding: "10px 20px",
            background: "#007bff",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            marginLeft: 10,
          }}
        >
          Search
        </button>

        {statusResult && (
          <div
            style={{
              marginTop: 30,
              padding: 20,
              background: "#f8f8f8",
              borderRadius: 10,
              border: "1px solid #ddd",
              maxWidth: 400,
            }}
          >
            <h2>Report Details</h2>

            <p><strong>Tracking ID:</strong> {statusResult.tracking_id}</p>
            <p><strong>Status:</strong> {statusResult.status}</p>
            <p><strong>Type:</strong> {statusResult.type}</p>
            <p><strong>Severity:</strong> {statusResult.severity}</p>
            <p><strong>Urgency:</strong> {statusResult.urgency}</p>
            <p><strong>Explanation:</strong> {statusResult.explanation}</p>

            {statusResult.image && (
              <p><strong>Stored Image:</strong> {statusResult.image}</p>
            )}
          </div>
        )}

        <button
          onClick={() => {
            setShowCheckStatus(false);
            setStatusResult(null);
            setCheckID("");
          }}
          style={{
            padding: "10px 20px",
            background: "#444",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            marginTop: 20,
          }}
        >
          ⬅ Back
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------
  // MY SUBMISSIONS PAGE
  // ------------------------------------------------------------
  if (showMyReports) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <h1>My Submissions</h1>

        {myReports.length === 0 && <p>No reports found.</p>}

        {myReports.map((rep, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 20,
              padding: 20,
              background: "#f8f8f8",
              borderRadius: 10,
              border: "1px solid #ddd",
              maxWidth: 450,
            }}
          >
            <p><strong>Tracking ID:</strong> {rep.tracking_id}</p>
            <p><strong>Status:</strong> {rep.status}</p>
            <p><strong>Type:</strong> {rep.type}</p>
            <p><strong>Severity:</strong> {rep.severity}</p>
            <p><strong>Submitted:</strong> {rep.created_at}</p>

            {rep.image && (
              <p><strong>Image:</strong> {rep.image}</p>
            )}
          </div>
        ))}

        <button
          onClick={() => setShowMyReports(false)}
          style={{
            padding: "10px 20px",
            background: "#444",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            marginTop: 20,
          }}
        >
          ⬅ Back
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------
  // FILE UPLOAD
  // ------------------------------------------------------------
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setImages(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
    setResults([]);
    setError("");
  };

  // ------------------------------------------------------------
  // GPS
  // ------------------------------------------------------------
  const getGPSLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGPS({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        alert("GPS permission denied.");
        console.error(err);
      }
    );
  };

  // ------------------------------------------------------------
  // ANALYZE SUBMISSION
  // ------------------------------------------------------------
  const analyzePothole = async () => {
    if (!images.length || !gps) {
      alert("Upload images and enable GPS.");
      return;
    }

    setLoading(true);
    setError("");

    const token = await getValidToken();
    if (!token) return;

    try {
      const formData = new FormData();
      images.forEach((img) => formData.append("images", img));
      formData.append("latitude", gps.lat);
      formData.append("longitude", gps.lon);

      const response = await fetch(BACKEND_ANALYZE, {
        method: "POST",
        headers: { "X-User-Token": token },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || data.error || "Server error");
        return;
      }

      setResults(data.results);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // LOOKUP STATUS
  // ------------------------------------------------------------
  async function lookupStatus() {
    if (!checkID.trim()) {
      alert("Enter a Tracking ID");
      return;
    }

    const token = await getValidToken();
    if (!token) return;

    try {
      const response = await fetch(`${BACKEND_STATUS}/${checkID}`, {
        headers: { "X-User-Token": token },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Tracking ID not found");
        return;
      }

      setStatusResult(data);
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  }

  // ------------------------------------------------------------
  // LOAD MY REPORTS
  // ------------------------------------------------------------
  async function loadMyReports() {
    const token = await getValidToken();
    if (!token) return;

    // ⭐ ADD THESE 3 LINES
    console.log("TOKEN USED FOR MYREPORTS:", token);
    console.log("BACKEND URL:", BACKEND_MYREPORTS);
    console.log("FETCH HEADERS:", {
      Authorization: `Bearer ${token}`,
    });

    try {
      const response = await fetch(BACKEND_MYREPORTS, {
        headers: { "X-User-Token": token },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Unable to load submissions");
        return;
      }

      setMyReports(data.reports);
      setShowMyReports(true);
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  }

  // ------------------------------------------------------------
  // MAIN PAGE
  // ------------------------------------------------------------
  return (
    <div className="container" style={{ padding: 20 }}>
      <h1>Pothole Analyzer</h1>

      <p>
        Logged in as <strong>{user.email}</strong>
      </p>

      <button
        onClick={() => setShowCheckStatus(true)}
        style={{
          padding: "10px 20px",
          background: "#28a745",
          color: "white",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 16,
          marginBottom: 20,
        }}
      >
        🔎 Check Report Status
      </button>

      <button
        onClick={loadMyReports}
        style={{
          padding: "10px 20px",
          background: "#6f42c1",
          color: "white",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 16,
          marginBottom: 20,
          marginLeft: 10,
        }}
      >
        📄 My Submissions
      </button>

      <div style={{ marginTop: 10 }}>
        <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
      </div>

      {previews.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 15,
          }}
        >
          {previews.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`preview-${idx}`}
              style={{
                width: 160,
                height: 160,
                objectFit: "cover",
                borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>
      )}

      <button
        onClick={getGPSLocation}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "#444",
          color: "white",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        📍 Use GPS
      </button>

      {gps && (
        <p style={{ marginTop: 10 }}>
          <strong>GPS:</strong> {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}
        </p>
      )}

      <button
        onClick={analyzePothole}
        disabled={!images.length || !gps || loading}
        style={{
          marginTop: 10,
          padding: "10px 20px",
          background: "#007bff",
          color: "white",
          borderRadius: 8,
          cursor: !images.length || !gps ? "not-allowed" : "pointer",
          fontSize: 16,
        }}
      >
        🔍 Analyze Images
      </button>

      {loading && <p>Analyzing…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default App;
