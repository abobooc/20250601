let video;
let handPose;
let hands = [];
let fingerPos = {x: 0, y: 0};
let thumbPos = {x: 0, y: 0};
let blocks = [];
let draggingBlock = null;
let offsetX = 0, offsetY = 0;
let resultMsg = "";

// 題庫
const questions = [
  ["淡", "江", "大", "學"],
  ["教", "育", "科", "技", "學", "系"]
];
let answer = [];
let blockW = 60, blockH = 50;
let answerSlots = [];
let slotY = 100;
let slotW = 60, slotH = 50;
let slotGap = 20;

let gameState = "ready"; // ready, playing, success, fail
let startBtn = {x: 20, y: 20, w: 100, h: 50};
let submitBtn = {x: 520, y: 400, w: 100, h: 50};
let selectBtn1 = {x: 140, y: 20, w: 120, h: 50};
let selectBtn2 = {x: 280, y: 20, w: 180, h: 50};
// restartBtn和retryBtn的x會在draw時動態計算
let restartBtn = {x: 0, y: 0, w: 120, h: 50};
let retryBtn = {x: 0, y: 0, w: 120, h: 50};
let startTime = 0;
let usedTime = 0;
let timer = 0;
let timeLimit = 120; // 秒
let selectedQuestion = 0;

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.hide();
  handPose.detectStart(video, gotHands);
  initGame();
}

function initGame() {
  answer = questions[selectedQuestion].slice();
  blockW = slotW = answer.length > 4 ? 48 : 60;
  blockH = slotH = answer.length > 4 ? 40 : 50;
  slotGap = answer.length > 4 ? 10 : 20;

  blocks = [];
  draggingBlock = null;
  offsetX = 0;
  offsetY = 0;
  resultMsg = "";
  answerSlots = [];
  let startX = (width - (answer.length * slotW + (answer.length - 1) * slotGap)) / 2;
  for (let i = 0; i < answer.length; i++) {
    answerSlots.push({
      x: startX + i * (slotW + slotGap),
      y: slotY,
      w: slotW,
      h: slotH,
      block: null
    });
  }
  // 隨機生成方塊，避開提交按鈕區域
  for (let i = 0; i < answer.length; i++) {
    let rx, ry;
    let tries = 0;
    do {
      rx = random(50, width - blockW - 50);
      ry = random(height / 2, height - blockH - 30);
      tries++;
      // 避開提交按鈕
    } while (
      rx + blockW > submitBtn.x - 10 &&
      rx < submitBtn.x + submitBtn.w + 10 &&
      ry + blockH > submitBtn.y - 10 &&
      ry < submitBtn.y + submitBtn.h + 10 &&
      tries < 100
    );
    blocks.push({
      txt: answer[i],
      x: rx,
      y: ry,
      w: blockW,
      h: blockH,
      locked: false
    });
  }
  startTime = 0;
  usedTime = 0;
  timer = 0;
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(255);
  image(video, 0, 0);

  // 支援多手操作
  let fingers = [];
  let thumbs = [];
  if (hands.length > 0) {
    for (let h = 0; h < hands.length; h++) {
      let hand = hands[h];
      if (hand.keypoints.length > 8) {
        let tip = hand.keypoints[8];
        let thumb = hand.keypoints[4];
        fingers.push({x: tip.x, y: tip.y, handIdx: h});
        thumbs.push({x: thumb.x, y: thumb.y, handIdx: h});
        // 畫圈
        fill(0, 255, 0);
        noStroke();
        circle(tip.x, tip.y, 18);
        fill(255, 0, 0);
        circle(thumb.x, thumb.y, 14);
      }
    }
  }

  // 題目選擇
  if (gameState === "ready") {
    drawBtn(selectBtn1, "淡江大學", selectedQuestion === 0 ? color(255, 200, 220) : color(100, 180, 255));
    drawBtn(selectBtn2, "教育科技學系", selectedQuestion === 1 ? color(255, 200, 220) : color(100, 180, 255));
    for (let f of fingers) {
      if (isFingerTouching(selectBtn1, f)) {
        selectedQuestion = 0;
        initGame();
      }
      if (isFingerTouching(selectBtn2, f)) {
        selectedQuestion = 1;
        initGame();
      }
      if (isFingerTouching(startBtn, f)) {
        gameState = "playing";
        startTime = millis();
      }
    }
    drawBtn(startBtn, "開始");
  }

  // 計時器
  if (gameState === "playing") {
    timer = floor((millis() - startTime) / 1000);
    let remain = max(0, timeLimit - timer);
    let min = nf(floor(remain / 60), 2);
    let sec = nf(remain % 60, 2);
    fill(0);
    textSize(28);
    textAlign(LEFT, TOP);
    text(`計時：${min}:${sec}`, 20, 20);

    if (remain <= 0) {
      gameState = "fail";
      usedTime = timeLimit;
      resultMsg = "遊戲失敗";
    }
  }

  // playing 狀態下才可操作方塊
  if (gameState === "playing" || gameState === "success" || gameState === "fail") {
    // 畫作答欄
    for (let i = 0; i < answerSlots.length; i++) {
      let slot = answerSlots[i];
      stroke(100, 180, 255);
      strokeWeight(2);
      fill(230);
      rect(slot.x, slot.y, slot.w, slot.h, 10);
      if (slot.block !== null) {
        let b = blocks[slot.block];
        fill(200);
        stroke(0);
        rect(slot.x, slot.y, blockW, blockH, 10);
        fill(0);
        textSize(32);
        textAlign(CENTER, CENTER);
        text(b.txt, slot.x + blockW / 2, slot.y + blockH / 2);
      }
    }

    // 畫出未鎖定的方塊
    for (let i = 0; i < blocks.length; i++) {
      let b = blocks[i];
      if (b.locked) continue;
      fill(200);
      stroke(0);
      rect(b.x, b.y, b.w, b.h, 10);
      fill(0);
      textSize(32);
      textAlign(CENTER, CENTER);
      text(b.txt, b.x + b.w / 2, b.y + b.h / 2);
    }

    // 多手拖曳邏輯
    if (draggingBlock !== null && !blocks[draggingBlock].locked) {
      // 找到對應手的食指與大拇指
      let dragHandIdx = blocks[draggingBlock].dragHandIdx;
      let f = fingers.find(ff => ff.handIdx === dragHandIdx);
      let t = thumbs.find(tt => tt.handIdx === dragHandIdx);
      if (f && t) {
        let d = dist(f.x, f.y, t.x, t.y);
        if (d > 15) {
          blocks[draggingBlock].x = f.x - offsetX;
          blocks[draggingBlock].y = f.y - offsetY;
        } else {
          // 放下方塊，檢查是否進入作答欄
          for (let i = 0; i < answerSlots.length; i++) {
            let slot = answerSlots[i];
            if (
              blocks[draggingBlock].x + blockW / 2 > slot.x &&
              blocks[draggingBlock].x + blockW / 2 < slot.x + slotW &&
              blocks[draggingBlock].y + blockH / 2 > slot.y &&
              blocks[draggingBlock].y + blockH / 2 < slot.y + slotH &&
              slot.block === null
            ) {
              blocks[draggingBlock].x = slot.x;
              blocks[draggingBlock].y = slot.y;
              blocks[draggingBlock].locked = true;
              slot.block = draggingBlock;
            }
          }
          draggingBlock = null;
        }
      }
    }

    // 多手自動拖曳判斷
    if (gameState === "playing" && draggingBlock === null) {
      for (let f of fingers) {
        for (let i = blocks.length - 1; i >= 0; i--) {
          let b = blocks[i];
          if (b.locked) continue;
          if (
            f.x > b.x &&
            f.x < b.x + b.w &&
            f.y > b.y &&
            f.y < b.y + b.h
          ) {
            draggingBlock = i;
            offsetX = b.w / 2;
            offsetY = b.h / 2;
            blocks[draggingBlock].dragHandIdx = f.handIdx; // 標記是哪隻手在拖
            break;
          }
        }
        if (draggingBlock !== null) break;
      }
    }

    // 多手4號節點(大拇指)單獨碰到已拼入作答欄的方塊時，可以重新移動
    if (draggingBlock === null) {
      for (let t of thumbs) {
        for (let i = 0; i < answerSlots.length; i++) {
          let slot = answerSlots[i];
          if (slot.block !== null) {
            let b = blocks[slot.block];
            if (
              t.x > b.x &&
              t.x < b.x + b.w &&
              t.y > b.y &&
              t.y < b.y + b.h
            ) {
              // 只有大拇指靠近，對應手的食指遠離時才觸發
              let f = fingers.find(ff => ff.handIdx === t.handIdx);
              if (f) {
                let d = dist(f.x, f.y, t.x, t.y);
                if (d > 60) {
                  b.locked = false;
                  slot.block = null;
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  // 提交按鈕
  if (gameState === "playing") {
    for (let f of fingers) {
      if (isFingerTouching(submitBtn, f)) {
        checkAnswer();
      }
    }
    drawBtn(submitBtn, "提交");
  }

  // 成功畫面
  if (gameState === "success") {
    let min = nf(floor(usedTime / 60), 2);
    let sec = nf(usedTime % 60, 2);
    fill(0, 180, 0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text(`恭喜你成功了\n本次用時：${min}:${sec}`, width / 2, height / 2 - 40);

    // 讓按鈕置中
    restartBtn.x = width / 2 - restartBtn.w / 2;
    restartBtn.y = height / 2 + 20;
    drawBtn(restartBtn, "重新開始");
    for (let f of fingers) {
      if (isFingerTouching(restartBtn, f)) {
        gameState = "ready";
        initGame();
      }
    }
  }

  // 失敗畫面
  if (gameState === "fail") {
    fill(200, 0, 0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text(`遊戲失敗`, width / 2, height / 2 - 40);

    // 讓按鈕置中
    retryBtn.x = width / 2 - retryBtn.w / 2;
    retryBtn.y = height / 2 + 20;
    drawBtn(retryBtn, "再次挑戰");
    for (let f of fingers) {
      if (isFingerTouching(retryBtn, f)) {
        gameState = "ready";
        initGame();
      }
    }
  }

  // 顯示結果
  if (resultMsg && gameState === "playing") {
    fill(0);
    textSize(28);
    text(resultMsg, 10, 80);
  }
}

// 修改drawBtn支援自訂顏色
function drawBtn(btn, label, bgColor) {
  if (!bgColor) bgColor = color(100, 180, 255);
  fill(bgColor);
  stroke(0);
  rect(btn.x, btn.y, btn.w, btn.h, 10);
  fill(0);
  textSize(24);
  textAlign(CENTER, CENTER);
  text(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
}

// 支援多手指判斷
function isFingerTouching(btn, finger = fingerPos) {
  return (
    finger.x > btn.x &&
    finger.x < btn.x + btn.w &&
    finger.y > btn.y &&
    finger.y < btn.y + btn.h
  );
}

// 檢查答案
function checkAnswer() {
  let userAns = answerSlots.map(slot => slot.block !== null ? blocks[slot.block].txt : "").join("");
  usedTime = min(timeLimit, floor((millis() - startTime) / 1000));
  if (userAns === answer.join("")) {
    gameState = "success";
  } else {
    gameState = "fail";
    resultMsg = "順序不正確，遊戲失敗";
  }
}

function keyPressed() {
  if (key === 'r' || key === 'R') {
    gameState = "ready";
    initGame();
  }
}
