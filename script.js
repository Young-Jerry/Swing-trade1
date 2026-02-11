const items = [
    "ema","macd","rsiLevel","rsiDiv","volume",
    "candlestick","support","trend","chartPattern",
    "adx","obv","fibo","news","risk"
];

// Function to calculate and update strength meter
function updateStrength() {
    let count = 0;

    items.forEach(id => {
        if(document.getElementById(id).checked) count++;
    });

    const meter = document.getElementById("meterFill");
    const percent = (count / items.length) * 100;
    meter.style.width = percent + "%";

    // Color gradient red → yellow → green
    if(percent < 40){
        meter.style.background = "red";
    } else if(percent < 70){
        meter.style.background = "yellow";
    } else {
        meter.style.background = "green";
    }

    document.getElementById("strengthText").innerText = `${count} / 14`;
}

// Attach change listener to every checkbox
items.forEach(id => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener("change", updateStrength);
});

// Reset function stays the same
function resetForm(){
    document.getElementById("tradeForm").reset();
    updateStrength();
}
