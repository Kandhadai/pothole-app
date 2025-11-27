const backendURL = "https://pothole-backend-117334135242.us-central1.run.app/analyze";

document.getElementById("analyzeBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("imageInput");
    const resultBox = document.getElementById("resultBox");

    if (!fileInput.files.length) {
        alert("Please select an image first.");
        return;
    }

    // Step 1: Get GPS
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        const formData = new FormData();
        formData.append("image", fileInput.files[0]);
        formData.append("latitude", latitude);
        formData.append("longitude", longitude);

        resultBox.textContent = "Analyzing...";

        try {
            const response = await fetch(backendURL, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            resultBox.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
            resultBox.textContent = "Error: " + err;
        }

    }, (err) => {
        alert("GPS access denied. Please allow location.");
    });
});
