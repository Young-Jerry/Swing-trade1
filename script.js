// Initial scale values
let macdGreenScale = 3;
let macdRedScale = 3;
let macdWhiteScale = 3;

// Update Strength Logic
function updateStrength() {
    let score = 0;

    // EMA
    const ema = document.querySelector('input[name="ema"]:checked')?.value;
    if(ema === 'bull') score += 20;
    else if(ema === 'bear') score -= 20;

    // MACD
    const macd = document.querySelector('input[name="macdColor"]:checked')?.value;
    if(macd === 'green') score += macdGreenScale * 4;
    else if(macd === 'red') score -= macdRedScale * 4;
    else if(macd === 'white') score += macdWhiteScale * 2; // Neutral

    // RSI
    const rsi = document.querySelector('input[name="rsi"]:checked')?.value;
    if(rsi === '<30') score += 20;
    else if(rsi === '30-40') score += 10;
    else if(rsi === '40-70') score += 5;
    else if(rsi === '>70') score -= 20;

    // ADX
    const adx = document.querySelector('input[name="adx"]:checked')?.value;
    let multiplier = 1;
    if(adx === '<20') multiplier = 0.5;
    else if(adx === '20-40') multiplier = 1;
    else if(adx === '>40') multiplier = 1.5;

    // OBV
    const obv = document.querySelector('input[name="obv"]:checked')?.value;
    if(obv === 'rising') score += 10;
    else if(obv === 'falling') score -= 10;

    // Volume
    const volume = document.querySelector('input[name="volume"]:checked')?.value;
    if(volume === 'above') score += 5;
    else if(volume === 'average') score += 2;
    else if(volume === 'below') score -= 5;

    // Candlestick
    const candle = document.querySelector('input[name="candle"]:checked')?.value;
    if(candle === 'bull') score += 5;
    else if(candle === 'bear') score -= 5;

    // Support/Resistance
    const sr = document.querySelector('input[name="sr"]:checked')?.value;
    if(sr === 'support') score += 5;
    else if(sr === 'resistance') score -= 5;

    // Trend Alignment
    const trend = document.querySelector('input[name="trend"]:checked')?.value;
    if(trend === 'bull') score *= 1.2;
    else if(trend === 'bear') score *= 0.8;

    // Chart Patterns
    const pattern = document.querySelector('input[name="pattern"]:checked')?.value;
    if(pattern === 'bull') score += 3; // Reduced marks
    else if(pattern === 'bear') score -= 3;

    // News
    const news = document.querySelector('input[name="news"]:checked')?.value;
    if(news === 'positive') score += 1; // Reduced marks
    else if(news === 'negative') score -= 1;

    // Apply ADX multiplier
    score *= multiplier;

    // Clamp and display
    score = Math.max(0, Math.min(100, Math.round(score)));
    const meter = document.getElementById("meterFill");
    const strengthText = document.getElementById("strengthText");

    meter.style.width = score + "%";
    if(score < 40) meter.style.background = "red";
    else if(score < 70) meter.style.background = "yellow";
    else meter.style.background = "green";

    strengthText.innerText = `${score} / 100`;
}

// Reset Functions
function resetForm() {
    document.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);
    macdGreenScale = 3;
    macdRedScale = 3;
    macdWhiteScale = 3;
    document.querySelectorAll('.scale-buttons button').forEach(btn => btn.classList.remove('active'));
    updateStrength();
}

// Reset Group
function resetGroup(name) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(el => el.checked = false);
    if(name === 'macdColor') {
        macdGreenScale = 3;
        macdRedScale = 3;
        macdWhiteScale = 3;
        document.querySelectorAll('#macdGreenButtons button, #macdRedButtons button, #macdWhiteButtons button').forEach(btn => btn.classList.remove('active'));
    }
    updateStrength();
}

// MACD Scale Buttons
function setupMacdButtons(id, type) {
    document.querySelectorAll(`#${id} button`).forEach(btn => {
        btn.addEventListener('click', function(){
            document.querySelectorAll(`#${id} button`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = parseInt(btn.dataset.value);
            if(type === 'green') macdGreenScale = val;
            else if(type === 'red') macdRedScale = val;
            else if(type === 'white') macdWhiteScale = val;
            updateStrength();
        });
    });
}

// Initialize
setupMacdButtons('macdGreenButtons', 'green');
setupMacdButtons('macdRedButtons', 'red');
setupMacdButtons('macdWhiteButtons', 'white');

document.querySelectorAll('input[type="radio"]').forEach(el => el.addEventListener('change', updateStrength));
updateStrength();
