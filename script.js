// Load the nav bar
fetch("navbar.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("navbar").innerHTML = data;
    });


const MODEL_URL = "./my-model/";
let model, webcam, maxPredictions;
let labelContainer; // Will be assigned after DOM loads

// Load the model when page loads
window.onload = async () => {
    try {
        console.log("Loading model...");
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        console.log("Model loaded successfully");

        // Get label container after DOM is ready
        labelContainer = document.getElementById("label-container");

        // Create label placeholders
        labelContainer.innerHTML = "";
        for (let i = 0; i < maxPredictions; i++) {
            labelContainer.appendChild(document.createElement("div"));
        }
    } catch (err) {
        console.error("Error loading model:", err);
    }
};

// Start webcam
async function startWebcam() {
    if (webcam) {
        webcam.stop();
    }

    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("webcam-container").style.display = "block";

    try {
        webcam = new tmImage.Webcam(300, 300, true); // width, height, flip
        await webcam.setup();
        await webcam.play();
        document.getElementById("webcam-container").innerHTML = "";
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        window.requestAnimationFrame(loop);
    } catch (err) {
        console.error("Error starting webcam:", err);
    }
}

// Loop to predict on webcam
async function loop() {
    webcam.update();
    await predict(webcam.canvas);
    window.requestAnimationFrame(loop);
}

// Handle image upload
document.getElementById("imageUpload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
        console.warn("No file selected.");
            return;
    }

    if (webcam) {
        webcam.stop();
        webcam = null;
        document.getElementById("webcam-container").style.display = "none";
    }

    const imageElement = document.getElementById("uploadedImage");
    imageElement.src = URL.createObjectURL(file);

    imageElement.onload = async () => {
        console.log("Image loaded. Predicting...");
        imageElement.style.display = "block";
        await predict(imageElement);
    };

    imageElement.onerror = () => {
        console.error("Failed to load image.");
    };
});


// improving formatting

function cleanRecommendation(rawText) {
  // Find text after "**Recommendation:**"
  const startIndex = rawText.indexOf("**Recommendation:**");
  let text = startIndex !== -1 ? rawText.substring(startIndex + 18).trim() : rawText;

  // Replace markdown formatting with HTML
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Format numbered list
  const numberedList = text.match(/(\d+\.\s[\s\S]+?)(?=\d+\.|$)/g);
  if (numberedList) {
    text = "<ol>" + numberedList.map(p => `<li>${p.trim()}</li>`).join("") + "</ol>";
  }

  return text;
}



// ✅ Prediction Function (core logic)
async function predict(source) {
    if (!model) {
        console.error("Model not loaded!");
        return;
    }

    console.log("Predicting on:", source);

    try {
        const prediction = await model.predict(source);
        console.log("Prediction result:", prediction);

        // Find the highest probability prediction
        const best = prediction.reduce((max, current) =>
            current.probability > max.probability ? current : max
        );

        const diseaseName = best.className;
        const probability = (best.probability * 100).toFixed(2);
          
        //  Get real-time recommendation from Ollama
        const recommendationText = await getRecommendation(diseaseName);
        const cleanedText = cleanRecommendation(recommendationText);


        // Display prediction
        const predictionHTML = `
            <div class="card p-3 mb-3 shadow-sm" style="border-radius: 12px;">
                <h5><strong>Diagnosis</strong></h5>
                <p id="prediction-output"  style="font-size: 16px;"><strong>Prediction:</strong> ${diseaseName} (${probability}%)</p>
            </div>

            <div class="card p-3 shadow-sm" style="border-radius: 12px;">
                <h5><strong>Recommendation:</strong></h5>
                <p id="recommendation-output" >${cleanedText}</p>
            </div>
        `;
    

        labelContainer.innerHTML = predictionHTML;

        console.log("Prediction Done:");

    } 
    catch (err) {
        console.error("Prediction error:", err);
        labelContainer.innerHTML = "❌ Prediction failed.";
    }
}


// ollama request response section 
async function getRecommendation(diseaseName) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: `You are an expert in plant pathology. For the disease "${diseaseName}", provide ONLY the following information in this exact format with line breaks (\\n). Do NOT add anything extra.

                **Disease**: <Disease name with scientific name if known>  
                **Symptoms**: <List 1-2 key symptoms in simple words>  
                **Impact**: <1 sentence on how it affects crop>  
                **Treatment**:  
                - <Short Step 1>  
                - <Short Step 2>  
                - <Short Step 3>

                Use \\n for each new line and avoid explanations or headers like "Here is the summary". Keep it simple and to the point.`,
        stream: false
      })
    });

    const data = await response.json();
    return data.response; //  This is the final suggestion text
  } catch (error) {
    console.error("Error getting recommendation:", error);
    return "Failed to fetch recommendation.";
  }
}




// ✅ Function to translate any text using LibreTranslate
async function translateText(text, targetLang = "hi") {
  try {
    const response = await fetch("http://localhost:4000/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: targetLang,
        format: "text"
      })
    });

    const data = await response.json();
    return data.translatedText;
  } catch (err) {
    console.error("Translation failed:", err);
    return text;
  }
}


// weaither
 // ✅ Declare this at the top of your script.js
const apiKey = "e6b8a9d68247425404063ab7c2a45172";

// ✅ Then define getWeather() after apiKey is declared
async function getWeather() {
  const city = document.getElementById("cityInput").value;
  if (!city) {
    alert("Please enter a city name.");
    return;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    document.getElementById("temp").innerText = `${data.main.temp}°C`;
    document.getElementById("desc").innerText = data.weather[0].description;
    document.getElementById("date").innerText = new Date().toDateString();
    document.getElementById("city").innerText = data.name;
    document.getElementById("humidity").innerText = `Humidity: ${data.main.humidity}%`;
    document.getElementById("pressure").innerText = `Pressure: ${data.main.pressure} hPa`;
  } catch (err) {
    console.error("Error fetching weather:", err);
    alert("Failed to fetch weather data.");
  }
}
