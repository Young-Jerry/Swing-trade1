let page="home";

let db={
  trades: JSON.parse(localStorage.getItem("trades"))||[],
  long: JSON.parse(localStorage.getItem("long"))||[],
  mf: JSON.parse(localStorage.getItem("mf"))||[]
};

function save(){
  Object.keys(db).forEach(k=>localStorage.setItem(k,JSON.stringify(db[k])));
}

function nav(p){ page=p; render(); }

function render(){
  let app=document.getElementById("app");

  // HOME
  if(page==="home"){
    let t=total(db.trades), l=total(db.long), m=total(db.mf);
    app.innerHTML=`
    <div class="flex">
      <div class="card">Trades ₨ ${fmt(t)}</div>
      <div class="card">Long ₨ ${fmt(l)}</div>
      <div class="card">MF ₨ ${fmt(m)}</div>
      <div class="card">Total ₨ ${fmt(t+l+m)}</div>
    </div>`;
  }

  // PORTFOLIOS
  if(["trades","long","mf"].includes(page)){
    let data=db[page];

    app.innerHTML=`
    <div class="card">
      <input id="s" placeholder="Script">
      <input id="sec" placeholder="Sector">
      <input id="q" placeholder="Qty">
      <input id="ltp" placeholder="LTP">
      <input id="sell1" placeholder="Sell1">
      <input id="wacc" placeholder="WACC">
      <button class="action" onclick="add('${page}')">Add</button>
    </div>

    <table>
      <tr>
        <th onclick="sort('${page}','script')">Script</th>
        <th>Sector</th>
        <th>LTP</th>
        <th>Sell Range</th>
        <th>Distance</th>
        <th>P/L</th>
        <th>Action</th>
      </tr>
      ${data.map((t,i)=>row(t,i,page)).join("")}
    </table>
    `;
  }

  // JOURNAL
  if(page==="journal"){
    let d=new Date();
    let key=d.toISOString().split("T")[0];
    let j=JSON.parse(localStorage.getItem("journal"))||{};
    let txt=j[key]||"";

    app.innerHTML=`
    <h2>${new Date().toDateString()}</h2>
    <textarea oninput="saveJ(this.value)">${txt}</textarea>
    `;
  }

  // CALCULATOR
  if(page==="calc"){
    app.innerHTML=`
    <div class="calc-box">
      <div class="calc-left">
        <input id="amt" placeholder="Amount">
        <button onclick="calc()">Calculate</button>
      </div>
      <div class="calc-right" id="res"></div>
    </div>`;
  }
}

function row(t,i,type){
  let sell2=t.sell1*1.1;
  let dist=(t.ltp*t.qty)-(t.sell1*t.qty);
  let pl=(t.ltp-t.wacc)*t.qty;
  let cls=pl>=0?"green":"red";

  return `
  <tr class="${t.ltp>=t.sell1?'highlight':''}">
    <td contenteditable onblur="edit(${i},'script',this.innerText,'${type}')">${t.script}</td>
    <td contenteditable onblur="edit(${i},'sector',this.innerText,'${type}')">${t.sector}</td>
    <td contenteditable onblur="edit(${i},'ltp',this.innerText,'${type}')">${t.ltp}</td>
    <td>${t.sell1} - ${sell2.toFixed(2)}</td>
    <td>${fmt(dist)}</td>
    <td class="${cls}">${fmt(pl)}</td>
    <td><button onclick="del('${type}',${i})">X</button></td>
  </tr>`;
}

function add(type){
  db[type].push({
    script:s.value,
    sector:sec.value,
    qty:+q.value,
    ltp:+ltp.value,
    sell1:+sell1.value,
    wacc:+wacc.value
  });
  save(); render();
}

function edit(i,key,val,type){
  if(["ltp","qty","sell1","wacc"].includes(key)) val=+val;
  db[type][i][key]=val;
  save(); render();
}

function del(type,i){
  db[type].splice(i,1);
  save(); render();
}

function total(arr){
  return arr.reduce((a,b)=>a+(b.ltp*b.qty),0);
}

function sort(type,key){
  db[type].sort((a,b)=>a[key]>b[key]?1:-1);
  render();
}

function saveJ(val){
  let key=new Date().toISOString().split("T")[0];
  let j=JSON.parse(localStorage.getItem("journal"))||{};
  j[key]=val;
  localStorage.setItem("journal",JSON.stringify(j));
}

function calc(){
  let amt=+document.getElementById("amt").value;
  let r=0;

  if(amt<=50000) r=0.004;
  else if(amt<=500000) r=0.0037;
  else if(amt<=2000000) r=0.0034;
  else if(amt<=10000000) r=0.003;
  else r=0.0027;

  let broker=amt*r;
  let sebon=amt*0.00015;
  let dp=25;

  document.getElementById("res").innerHTML=`
    <div><span>Broker</span><span>${fmt(broker)}</span></div>
    <div><span>SEBON</span><span>${fmt(sebon)}</span></div>
    <div><span>DP</span><span>${dp}</span></div>
    <div><span>Total</span><span>${fmt(amt+broker+sebon+dp)}</span></div>
  `;
}

function fmt(x){
  return Number(x).toLocaleString("en-IN");
}

render();
