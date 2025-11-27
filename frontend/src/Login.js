import React from "react";
import { loginWithGoogle } from "./firebase";

export default function Login({ onLogin }) {
  const handleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      onLogin(result.user);
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  return (
    <button
      onClick={handleLogin}
      style={{
        padding: "10px 20px",
        background: "#db4437",
        color: "white",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 16,
        marginTop: 20,
      }}
    >
      Sign In with Google
    </button>
  );
}
