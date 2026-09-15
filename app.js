const input = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const workspace = document.querySelector('#workspace');
const canvas = document.querySelector('#result-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const processing = document.querySelector('#processing');
const message = document.querySelector('#message');
const sensitivity = document.querySelector('#sensitivity');
const sensitivityOutput = document.querySelector('#sensitivity-output');
const signaturePad = document.querySelector('#signature-pad');
const signatureCanvas = document.querySelector('#signature-canvas');
const signatureContext = signatureCanvas.getContext('2d');
const penSize = document.querySelector('#pen-size');
let original = null, currentFile = null, mode = 'photo', rotation = 0;
let isDrawing = false, lastPoint = null, signatureHistory = [], signatureHasInk = false;

function setMessage(text = '') { message.textContent = text; }
function draw() {
  if (!original) return;
  const sideways = Math.abs(rotation % 180) === 90;
  canvas.width = sideways ? original.height : original.width;
  canvas.height = sideways ? original.width : original.height;
  ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(original, -original.width / 2, -original.height / 2); ctx.restore();
}
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return setMessage('PNG, JPG 또는 WEBP 이미지를 선택해 주세요.');
  if (file.size > 20 * 1024 * 1024) return setMessage('20MB 이하의 이미지를 선택해 주세요.');
  const image = new Image(); const url = URL.createObjectURL(file);
  image.onload = () => { URL.revokeObjectURL(url); original = image; currentFile = file; rotation = 0; draw(); document.querySelector('#file-name').textContent = file.name; document.querySelector('#image-size').textContent = `${image.naturalWidth} × ${image.naturalHeight}`; dropZone.classList.add('hidden'); workspace.classList.remove('hidden'); setMessage(''); };
  image.onerror = () => setMessage('이미지를 열 수 없습니다.'); image.src = url;
}
function colorDistance(data, a, b) { const r=data[a]-data[b], g=data[a+1]-data[b+1], bl=data[a+2]-data[b+2]; return Math.sqrt(r*r+g*g+bl*bl); }
function extractSignature() {
  draw(); const image = ctx.getImageData(0, 0, canvas.width, canvas.height); const { data, width:w, height:h } = image;
  // The paper colour is measured from the outer edge, where a signature is unlikely to appear.
  let brightness = 0, samples = 0;
  for (let x=0; x<w; x++) for (const y of [0, h-1]) { const i=(y*w+x)*4; brightness += .2126*data[i]+.7152*data[i+1]+.0722*data[i+2]; samples++; }
  for (let y=1; y<h-1; y++) for (const x of [0, w-1]) { const i=(y*w+x)*4; brightness += .2126*data[i]+.7152*data[i+1]+.0722*data[i+2]; samples++; }
  const paper = brightness / samples, cutoff = Number(sensitivity.value) * .72;
  for (let i=0; i<data.length; i+=4) { const pixel = .2126*data[i]+.7152*data[i+1]+.0722*data[i+2]; const ink = paper - pixel; data[i+3] = Math.max(0, Math.min(255, Math.round((ink - cutoff) * 5.2))); }
  ctx.putImageData(image, 0, 0);
}
function removeBackground() {
  if (!original) return; processing.classList.remove('hidden'); setMessage('');
  requestAnimationFrame(() => setTimeout(() => {
    if (mode === 'signature') { extractSignature(); processing.classList.add('hidden'); return; }
    draw(); const image = ctx.getImageData(0, 0, canvas.width, canvas.height); const { data, width:w, height:h } = image;
    const pixels = w*h, visited = new Uint8Array(pixels), queue = new Int32Array(pixels), threshold = Number(sensitivity.value) * 1.85; let start=0, end=0;
    const add = i => { if (!visited[i]) { visited[i]=1; queue[end++]=i; } };
    for (let x=0;x<w;x++) { add(x); add((h-1)*w+x); } for (let y=1;y<h-1;y++) { add(y*w); add(y*w+w-1); }
    while (start < end) { const p=queue[start++], x=p%w, y=(p-x)/w, at=p*4; const neighbors=[]; if(x) neighbors.push(p-1); if(x<w-1) neighbors.push(p+1); if(y) neighbors.push(p-w); if(y<h-1) neighbors.push(p+w); for (const n of neighbors) { if (visited[n]) continue; const nt=n*4; if (colorDistance(data,at,nt) <= threshold) add(n); } }
    for (let p=0;p<pixels;p++) if (visited[p]) { const i=p*4; let edge=false; const x=p%w, y=(p-x)/w; if (x && !visited[p-1]) edge=true; if(x<w-1 && !visited[p+1]) edge=true; if(y && !visited[p-w]) edge=true; if(y<h-1 && !visited[p+w]) edge=true; data[i+3] = edge ? 35 : 0; }
    ctx.putImageData(image,0,0); processing.classList.add('hidden');
  }, 20));
}
document.querySelector('#select-button').onclick = e => { e.stopPropagation(); input.click(); }; dropZone.onclick = () => input.click(); dropZone.onkeydown=e=>{if(e.key==='Enter'||e.key===' ') input.click();}; input.onchange=e=>loadFile(e.target.files[0]);
['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.add('dragover');})); ['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.remove('dragover');})); dropZone.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
sensitivity.oninput=()=>{sensitivityOutput.textContent=sensitivity.value;}; document.querySelector('#remove-button').onclick=removeBackground; document.querySelector('#reset-button').onclick=()=>draw(); document.querySelector('#new-image-button').onclick=()=>input.click(); document.querySelector('#download-button').onclick=()=>{if(!original)return; const a=document.createElement('a'); a.download=(currentFile?.name?.replace(/\.[^.]+$/, '')||'image')+'-cutout.png'; a.href=canvas.toDataURL('image/png'); a.click();};
document.querySelector('#rotate-left').onclick = () => { rotation = (rotation + 270) % 360; draw(); };
document.querySelector('#rotate-right').onclick = () => { rotation = (rotation + 90) % 360; draw(); };
document.querySelectorAll('.mode-button').forEach(button => button.onclick = () => { mode = button.dataset.mode; document.querySelectorAll('.mode-button').forEach(item => item.classList.toggle('active', item === button)); const signature = mode === 'signature'; sensitivity.value = signature ? 32 : 38; sensitivityOutput.textContent = sensitivity.value; document.querySelector('label[for="sensitivity"]').childNodes[0].nodeValue = signature ? '잉크 감도 ' : '배경 감도 '; document.querySelector('#sensitivity-hint').textContent = signature ? '값을 낮추면 연한 펜 자국까지 남길 수 있습니다.' : '값을 높이면 배경으로 인식하는 범위가 넓어집니다.'; document.querySelector('#remove-button').textContent = signature ? '서명 추출' : '배경 제거'; draw(); });

function signaturePoint(event) { const rect = signatureCanvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * signatureCanvas.width / rect.width, y: (event.clientY - rect.top) * signatureCanvas.height / rect.height }; }
function saveSignature() { signatureHistory.push({ image: signatureContext.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height), hasInk: signatureHasInk }); if (signatureHistory.length > 30) signatureHistory.shift(); }
function setSignatureBoardState() { document.querySelector('.signature-board').classList.toggle('has-ink', signatureHasInk); }
function beginSignature(event) { event.preventDefault(); saveSignature(); isDrawing = true; lastPoint = signaturePoint(event); signatureCanvas.setPointerCapture(event.pointerId); signatureContext.beginPath(); signatureContext.arc(lastPoint.x, lastPoint.y, Number(penSize.value) * 1.2, 0, Math.PI * 2); signatureContext.fillStyle = '#111827'; signatureContext.fill(); signatureHasInk = true; setSignatureBoardState(); }
function drawSignature(event) { if (!isDrawing) return; const point = signaturePoint(event); signatureContext.beginPath(); signatureContext.moveTo(lastPoint.x, lastPoint.y); signatureContext.lineTo(point.x, point.y); signatureContext.strokeStyle = '#111827'; signatureContext.lineWidth = Number(penSize.value) * 2.4; signatureContext.lineCap = 'round'; signatureContext.lineJoin = 'round'; signatureContext.stroke(); lastPoint = point; setSignatureBoardState(); }
function endSignature(event) { if (!isDrawing) return; isDrawing = false; lastPoint = null; if (signatureCanvas.hasPointerCapture(event.pointerId)) signatureCanvas.releasePointerCapture(event.pointerId); }
signatureCanvas.addEventListener('pointerdown', beginSignature); signatureCanvas.addEventListener('pointermove', drawSignature); signatureCanvas.addEventListener('pointerup', endSignature); signatureCanvas.addEventListener('pointercancel', endSignature);
penSize.oninput = () => { document.querySelector('#pen-size-output').textContent = penSize.value; };
function openSignaturePad() { dropZone.classList.add('hidden'); workspace.classList.add('hidden'); signaturePad.classList.remove('hidden'); setMessage(''); }
document.querySelector('#open-signature-pad').onclick = openSignaturePad;
document.querySelector('#open-signature-pad-empty').onclick = event => { event.stopPropagation(); openSignaturePad(); };
document.querySelector('#back-to-editor').onclick = () => { signaturePad.classList.add('hidden'); if (original) workspace.classList.remove('hidden'); else dropZone.classList.remove('hidden'); };
document.querySelector('#undo-signature').onclick = () => { const previous = signatureHistory.pop(); if (previous) { signatureContext.putImageData(previous.image, 0, 0); signatureHasInk = previous.hasInk; } setSignatureBoardState(); };
document.querySelector('#clear-signature').onclick = () => { saveSignature(); signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height); signatureHasInk = false; setSignatureBoardState(); };
document.querySelector('#download-signature').onclick = () => { if (!signatureHasInk) return setMessage('먼저 서명을 그려 주세요.'); const a = document.createElement('a'); a.download = 'signature.png'; a.href = signatureCanvas.toDataURL('image/png'); a.click(); };
