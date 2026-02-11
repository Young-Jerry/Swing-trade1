// List of all tick box IDs
const tickBoxes = [
    "emaBull","emaBear",
    "macdGreen","macdRed","macdWhite",
    "rsiUnder30","rsi3040","rsi4070","rsiOver70",
    "adxLow","adxMid","adxHigh",
    "obvRising","obvFalling",
    "volAbove","volBelow",
    "candleBull","candleBear",
    "support","resistance",
    "trendBull","trendBear",
    "patternBull","patternBear",
    "newsPositive","newsNeutral","newsNegative"
];

// Function to calculate strength dynamically
function updateStrength() {
    let score = 0;

    tickBoxes.forEach(id => {
        const el = document.getElementById(id);
        if(el.checked){
            // MACD special weights
            if(id === "macdGreen") score += parseInt(document.getElementById("macdGreenScale").value);
            else if(id === "macdRed") score -= parseInt(document.getElementById("macdRedScale").value);
            else if(id === "macdWhite") score += 0; // neutral
            else score += 1; // all other tick boxes
        }
    });

    // Clamp score for display
    let displayScore = Math.max(0, score);
    document.getElementById("strengthText").innerText = `${displayScore} / 100`;

    // Update meter
    const meter = document.getElementById("meterFill");
    let percent = Math.min(100, Math.max(0, displayScore));
    meter.style.width = percent + "%";

    // Dynamic color red→yellow→green
    if(percent < 40) meter.style.background = "red";
    else if(percent < 70) meter.style.background = "yellow";
    else meter.style.background = "green";
}

// Attach event listeners to all tick boxes and MACD selects
tickBoxes.forEach(id => {
    document.getElementById(id).addEventListener("change", updateStrength);
});

document.getElementById("macdGreenScale").addEventListener("change", updateStrength);
document.getElementById("macdRedScale").addEventListener("change", updateStrength);

// Reset function
function resetForm(){
    tickBoxes.forEach(id => {
        document.getElementById(id).checked = false;
    });
    document.getElementById("macdGreenScale").value = "3";
    document.getElementById("macdRedScale").value = "3";
    updateStrength();
}

// Initialize
updateStrength();
