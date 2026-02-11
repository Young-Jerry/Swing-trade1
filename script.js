function calculateScore() {
    const items = [
        "ema","macd","rsiLevel","rsiDiv","volume",
        "candlestick","support","trend","chartPattern",
        "adx","obv","fibo","news","risk"
    ];

    let count = 0;

    items.forEach(id => {
        if(document.getElementById(id).checked) count++;
    });

    // Update meter
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

    // Update text
    document.getElementById("strengthText").innerText = `${count} / 14`;
}

function resetForm(){
    document.getElementById("tradeForm").reset();
    const meter = document.getElementById("meterFill");
    meter.style.width = "0%";
    meter.style.background = "red";
    document.getElementById("strengthText").innerText = "0 / 14";
}
