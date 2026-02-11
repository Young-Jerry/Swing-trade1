// Initial scales for MACD
let macdScales = { green: 3, red: 3, white: 3 };

// Update Trade Signal dynamically
function updateSignal() {
    let score = 0;

    // EMA
    const ema = document.querySelector('input[name="ema"]:checked')?.value;
    if(ema === 'bull') score += 3;
    else if(ema === 'bear') score -= 3;

    // MACD
    const macd = document.querySelector('input[name="macdColor"]:checked')?.value;
    if(macd === 'green') score += macdScales.green;
    else if(macd === 'red') score -= macdScales.red;
    else if(macd === 'white') score += 0; // neutral

    // RSI
    const rsi = document.querySelector('input[name="rsi"]:checked')?.value;
    if(rsi === '<30') score += 3;
    else if(rsi === '30-40') score += 2;
    else if(rsi === '40-70') score += 0;
    else if(rsi === '>70') score -= 3;

    // ADX
    const adx = document.querySelector('input[name="adx"]:checked')?.value;
    if(adx === '<20') score += 0.5;
    else if(adx === '20-40') score += 1;
    else if(adx === '>40') score += 1.5;

    // OBV
    const obv = document.querySelector('input[name="obv"]:checked')?.value;
    if(obv === 'rising') score += 1.5;
    else if(obv === 'falling') score -= 1.5;

    // Volume
    const volume = document.querySelector('input[name="volume"]:checked')?.value;
    if(volume === 'above') score += 1;
    else if(volume === 'average') score += 0.5;
    else if(volume === 'below') score -= 1;

    // Candlestick
    const candle = document.querySelector('input[name="candle"]:checked')?.value;
    if(candle === 'bull') score += 1;
    else if(candle === 'bear') score -= 1;

    // Support / Resistance
    const sr = document.querySelector('input[name="sr"]:checked')?.value;
    if(sr === 'support') score += 1;
    else if(sr === 'resistance') score -= 1;

    // Trend Alignment
    const trend = document.querySelector('input[name="trend"]:checked')?.value;
    if(trend === 'bull') score += 2;
    else if(trend === 'bear') score -= 2;

    // Chart Patterns
    const pattern = document.querySelector('input[name="pattern"]:checked')?.value;
    if(pattern === 'bull') score += 1;
    else if(pattern === 'bear') score -= 1;

    // News / Sentiment
    const news = document.querySelector('input[name="news"]:checked')?.value;
    if(news === 'positive') score += 0.5;
    else if(news === 'negative') score -= 0.5;

    // Map score to signal
    let signal = 'Neutral';
    let fillColor = 'yellow';
    let glow = false;
    if(score >= 8){ signal = 'Strong Buy'; fillColor = 'green'; glow = true; }
    else if(score >= 4){ signal = 'Buy'; fillColor = 'green'; glow = true; }
    else if(score <= -8){ signal = 'Strong Sell'; fillColor = 'red'; glow = true; }
    else if(score <= -4){ signal = 'Sell'; fillColor = 'red'; glow = true; }

    // Update meter
    const meter = document.getElementById('meterFill');
    meter.style.width = '100%';
    meter.style.background = fillColor;
    if(glow) meter.classList.add('glow');
    else meter.classList.remove('glow');

    // Update text
    document.getElementById('strengthText').innerText = signal;

    // Add to local log
    addToLog(signal);
}

// Add Trade to Log
function addToLog(signal) {
    let log = JSON.parse(localStorage.getItem('tradeLog')) || [];
    const time = new Date().toLocaleTimeString();
    log.unshift(`${time}: ${signal}`);
    if(log.length > 5) log.pop();
    localStorage.setItem('tradeLog', JSON.stringify(log));

    const logUl = document.getElementById('tradeLog');
    logUl.innerHTML = '';
    log.forEach(item => { const li = document.createElement('li'); li.textContent = item; logUl.appendChild(li); });
}

// Reset group
function resetGroup(name){
    document.querySelectorAll(`input[name="${name}"]`).forEach(el => el.checked=false);
    if(name==='macdColor'){
        macdScales.green=3; macdScales.red=3; macdScales.white=3;
        document.querySelectorAll('#macdGreenButtons button, #macdRedButtons button, #macdWhiteButtons button').forEach(b=>b.classList.remove('active'));
    }
    updateSignal();
}

// MACD scale buttons
function setupMacdButtons(id,type){
    document.querySelectorAll(`#${id} button`).forEach(btn=>{
        btn.addEventListener('click',function(){
            document.querySelectorAll(`#${id} button`).forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            macdScales[type]=parseInt(btn.dataset.value);
            updateSignal();
        });
    });
}

// Initialize
setupMacdButtons('macdGreenButtons','green');
setupMacdButtons('macdRedButtons','red');
setupMacdButtons('macdWhiteButtons','white');
document.querySelectorAll('input[type="radio"]').forEach(el=>el.addEventListener('change', updateSignal));

// Load previous log
(function(){ updateSignal(); })();
