const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const GAME_PASSWORD = process.env.GAME_PASSWORD || '';
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const publicDir = path.join(__dirname, 'public');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
const cloudReady = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const defaultCharacters = [
  {id:'sheetal',name:'Sheetal',tier:'SSS',power:100,price:1000,rarity:'Ultimate Legendary',ability:'Ability to be configured',description:'Top-ranked character.'},
  {id:'mannat',name:'Mannat',tier:'A',power:95,price:300,rarity:'Rare',ability:'Ability to be configured',description:'Legendary character.'},
  {id:'namrata',name:'Namrata',tier:'S',power:78,price:500,rarity:'Epic',ability:'Ability to be configured',description:'Rare character.'},
  {id:'riya',name:'Riya',tier:'SSS',power:99,price:1000,rarity:'Ultimate Legendary',ability:'Ability to be configured',description:'Second-highest power.'},
  {id:'vibha',name:'Vibha',tier:'SS',power:76,price:800,rarity:'Legendary',ability:'Ability to be configured',description:'Rare character.'},
  {id:'wacha',name:'Wacha',tier:'SS',power:68,price:800,rarity:'Legendary',ability:'Ability to be configured',description:'Uncommon character.'},
  {id:'raanu',name:'Raanu',tier:'B',power:89,price:100,rarity:'Uncommon',ability:'Ability to be configured',description:'Legendary character.'},
  {id:'trisha',name:'Trisha',tier:'SS',power:93,price:800,rarity:'Legendary',ability:'Ability to be configured',description:'Legendary character.'},
  {id:'himani',name:'Himani',tier:'B',power:84,price:100,rarity:'Uncommon',ability:'Ability to be configured',description:'Epic character.'},
  {id:'sikha',name:'Sikha',tier:'B',power:74,price:100,rarity:'Uncommon',ability:'Ability to be configured',description:'Rare character.'},
  {id:'chanchal',name:'Chanchal',tier:'SSS',power:98,price:1000,rarity:'Ultimate Legendary',ability:'Ability to be configured',description:'Third-highest power.'},
  {id:'kashish',name:'Kashish',tier:'SS',power:91,price:800,rarity:'Legendary',ability:'Ability to be configured',description:'Legendary character.'},
  {id:'manvi',name:'Manvi',tier:'A',power:86,price:300,rarity:'Rare',ability:'Ability to be configured',description:'Epic character.'},
  {id:'rasmi',name:'Rasmi',tier:'S',power:70,price:500,rarity:'Epic',ability:'Ability to be configured',description:'Uncommon character.'},
  {id:'archana',name:'Archana',tier:'B',power:82,price:100,rarity:'Uncommon',ability:'Ability to be configured',description:'Epic character.'},
  {id:'neha',name:'Neha',tier:'A',power:75,price:300,rarity:'Rare',ability:'Ability to be configured',description:'New default character.'}
];
function readRoster(){
  try {
    const saved=JSON.parse(fs.readFileSync(ROSTER_FILE,'utf8'));
    const savedById=new Map(saved.map(c=>[c.id,c]));
    const defaults=defaultCharacters.map(c=>({...c,...(savedById.get(c.id)||{}),isDefault:true}));
    const extras=saved.filter(c=>!defaultCharacters.some(d=>d.id===c.id)).map(c=>({...c,isDefault:false}));
    return [...defaults,...extras];
  } catch { return defaultCharacters.map(c=>({...c,isDefault:true,imageUrl:null})); }
}
let roster=readRoster();
function saveRoster(){fs.writeFileSync(ROSTER_FILE,JSON.stringify(roster,null,2));}
const sessions=new Map();
function newToken(){return crypto.randomBytes(32).toString('hex');}
function authGame(req,res,next){const token=req.get('x-game-token');if(!token||!sessions.has(token)||sessions.get(token).admin)return res.status(401).json({error:'Please unlock the game again.'});req.gameToken=token;next();}
function authAdmin(req,res,next){const token=req.get('x-admin-token');const session=token&&sessions.get(token);if(!session?.admin)return res.status(401).json({error:'Admin login required.'});next();}
app.post('/api/auth/game',(req,res)=>{
  if(!GAME_PASSWORD)return res.status(503).json({error:'Set GAME_PASSWORD in the hosting environment first.'});
  if(String(req.body?.password||'')!==GAME_PASSWORD)return res.status(401).json({error:'Incorrect game password.'});
  const token=newToken();sessions.set(token,{admin:false,createdAt:Date.now()});res.json({ok:true,token});
});
app.post('/api/auth/admin',(req,res)=>{
  if(!ADMIN_PASSWORD)return res.status(503).json({error:'Set ADMIN_PASSWORD in Render Environment Variables first.'});
  if(String(req.body?.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Incorrect admin password.'});
  const token=newToken();sessions.set(token,{admin:true,createdAt:Date.now()});res.json({ok:true,token});
});
app.get('/api/admin/roster',authAdmin,(_req,res)=>res.json({characters:roster,cloudReady}));
const imageUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_IMAGE_UPLOAD_BYTES},fileFilter:(_req,file,cb)=>['image/png','image/jpeg','image/webp','image/gif'].includes(file.mimetype)?cb(null,true):cb(new Error('Upload PNG, JPG, WEBP or GIF.'))});
async function uploadCloudImage(file,id){
  if(!cloudReady)throw new Error('Cloudinary is not configured. Add its three environment variables in Render.');
  return new Promise((resolve,reject)=>{
    const stream=cloudinary.uploader.upload_stream({folder:'character-auction',public_id:id,overwrite:true,resource_type:'image',type:'authenticated',allowed_formats:['jpg','jpeg','png','webp','gif']},(err,result)=>err?reject(err):resolve(result));
    stream.end(file.buffer);
  });
}
app.post('/api/admin/characters/:id/image',authAdmin,(req,res)=>imageUpload.single('image')(req,res,async err=>{
  if(err)return res.status(400).json({error:err.message});
  try{
    const c=roster.find(x=>x.id===req.params.id);if(!c)return res.status(404).json({error:'Character not found.'});
    if(!req.file)return res.status(400).json({error:'Choose an image to upload.'});
    const result=await uploadCloudImage(req.file,c.id);
    c.imageUrl=result.secure_url;c.cloudPublicId=result.public_id;c.imageVersion=result.version;saveRoster();res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message||'Cloudinary upload failed.'});}
}));
app.post('/api/admin/characters',authAdmin,(req,res)=>{
  const name=String(req.body?.name||'').trim().slice(0,32),tier=String(req.body?.tier||'').toUpperCase(),price=Number(req.body?.price),power=Number(req.body?.power??50);
  if(!name||!['SSS','SS','S','A','B'].includes(tier)||!Number.isSafeInteger(price)||price<1||!Number.isFinite(power)||power<0||power>100)return res.status(400).json({error:'Enter a name, valid tier, positive whole-number price and power from 0 to 100.'});
  const id='custom-'+crypto.randomBytes(6).toString('hex');const c={id,name,tier,power:Math.round(power),price,rarity:tier+' Tier',ability:'Ability to be configured',description:'Custom character added by admin.',imageUrl:null,isDefault:false};roster.push(c);saveRoster();res.json({ok:true,character:c});
});
app.delete('/api/admin/characters/:id',authAdmin,async(req,res)=>{
  const index=roster.findIndex(c=>c.id===req.params.id);if(index<0)return res.status(404).json({error:'Character not found.'});
  if(roster[index].isDefault||defaultCharacters.some(c=>c.id===req.params.id))return res.status(403).json({error:'Default characters cannot be removed.'});
  const [removed]=roster.splice(index,1);saveRoster();
  if(cloudReady&&removed.cloudPublicId){try{await cloudinary.uploader.destroy(removed.cloudPublicId,{type:'authenticated',resource_type:'image'});}catch{}}
  res.json({ok:true});
});
app.get('/api/character-image/:id',authGame,async(req,res)=>{
  const c=roster.find(x=>x.id===req.params.id);if(!c?.cloudPublicId||!cloudReady)return res.status(404).end();
  try{const signed=cloudinary.url(c.cloudPublicId,{secure:true,type:'authenticated',sign_url:true,version:c.imageVersion,expires_at:Math.floor(Date.now()/1000)+300});res.redirect(302,signed);}catch{res.status(404).end();}
});

const STARTING_BUDGET=15000;const rooms=new Map();const cloneCharacters=()=>roster.map(c=>({...c}));
function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code=Array.from({length:6},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');}while(rooms.has(code));return code;}
function totalPower(p){return p.characters.reduce((s,c)=>s+c.power,0);}
function imageFor(c){if(c?.cloudPublicId&&cloudReady){try{return cloudinary.url(c.cloudPublicId,{secure:true,type:'authenticated',sign_url:true,version:c.imageVersion});}catch{}}return c?.imageUrl||null;}
function publicRoom(room){
  // In Surprise Mode, reveal only characters already presented in the auction.
  // Never send the upcoming selected character list to clients ahead of time.
  const visibleCharacters=room.surpriseMode
    ? room.characters.slice(0, room.status==='waiting' ? 0 : Math.min(room.auctionIndex+(room.currentAuction?1:0),room.characters.length))
    : room.characters;
  return {code:room.code,status:room.status,paused:room.paused,surpriseMode:!!room.surpriseMode,remainingMs:room.paused?room.remainingMs:null,hostId:room.hostId,players:room.players.map(p=>({id:p.id,name:p.name,budget:p.budget,characters:p.characters.map(c=>({id:c.id,name:c.name,tier:c.tier,power:c.power,pricePaid:c.pricePaid,imageUrl:imageFor(c)})),...(room.status==='finished'?{totalPower:totalPower(p)}:{})})),characters:visibleCharacters.map(c=>{const {cloudPublicId,imageVersion,...safe}=c;return {...safe,imageUrl:imageFor(c)};}),auctionCharacterCount:room.characters.length,auctionIndex:room.auctionIndex,currentAuction:room.currentAuction,history:room.status==='finished'?room.history:[],winnerId:room.winnerId||null};
}
function emitRoom(room){io.to(room.code).emit('room:update',publicRoom(room));}
function playerById(room,id){return room.players.find(p=>p.id===id);}
function stopTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null;}}
function scheduleTimer(room){stopTimer(room);if(room.paused||!room.currentAuction)return;const expected=room.currentAuction.characterId;room.timer=setTimeout(()=>{const latest=rooms.get(room.code);if(latest&&latest.status==='auction'&&!latest.paused&&latest.currentAuction?.characterId===expected)closeAuction(latest);},Math.max(0,room.currentAuction.endsAt-Date.now()));}
function closeAuction(room){if(!room.currentAuction||room.paused)return;const a=room.currentAuction;const character=room.characters.find(c=>c.id===a.characterId);if(a.highestBidderId){const winner=playerById(room,a.highestBidderId);if(winner&&character&&!room.soldIds.has(character.id)){winner.budget-=a.highestBid;winner.characters.push({...character,pricePaid:a.highestBid});room.soldIds.add(character.id);room.history.push({characterId:character.id,characterName:character.name,winnerId:winner.id,winnerName:winner.name,price:a.highestBid,result:'SOLD'});}}else room.history.push({characterId:character?.id,characterName:character?.name,winnerId:null,winnerName:null,price:0,result:'UNSOLD'});room.currentAuction=null;room.auctionIndex++;emitRoom(room);setTimeout(()=>advanceAuction(room.code),1200);}
function advanceAuction(code){const room=rooms.get(code);if(!room||room.status!=='auction'||room.currentAuction||room.paused)return;if(room.auctionIndex>=room.characters.length){room.status='finished';const ranked=[...room.players].sort((a,b)=>totalPower(b)-totalPower(a));const top=ranked[0]?totalPower(ranked[0]):0;const tied=ranked.filter(p=>totalPower(p)===top);room.winnerId=tied.length>1?'tie':ranked[0]?.id;emitRoom(room);return;}const c=room.characters[room.auctionIndex];room.currentAuction={characterId:c.id,startingPrice:c.price,highestBid:c.price,highestBidderId:null,endsAt:Date.now()+20000};scheduleTimer(room);emitRoom(room);}

io.use((socket,next)=>{const token=socket.handshake.auth?.gameToken;if(!token||!sessions.has(token)||sessions.get(token).admin)return next(new Error('Game password required.'));socket.data.gameToken=token;next();});
io.on('connection',socket=>{
 socket.on('room:create',({name},cb)=>{const n=String(name||'').trim().slice(0,20);if(!n)return cb?.({ok:false,error:'Enter your player name.'});const code=makeCode();const player={id:socket.id,name:n,budget:STARTING_BUDGET,characters:[]};const room={code,hostId:socket.id,players:[player],status:'waiting',paused:false,surpriseMode:false,characters:cloneCharacters(),auctionIndex:0,currentAuction:null,history:[],soldIds:new Set(),winnerId:null,timer:null};rooms.set(code,room);socket.join(code);cb?.({ok:true,code});emitRoom(room);});
 socket.on('room:join',({code,name},cb)=>{const r=rooms.get(String(code||'').trim().toUpperCase()),n=String(name||'').trim().slice(0,20);if(!n)return cb?.({ok:false,error:'Enter your player name.'});if(!r)return cb?.({ok:false,error:'Room code not found.'});if(r.status!=='waiting')return cb?.({ok:false,error:'This auction has already started.'});if(r.players.length>=3)return cb?.({ok:false,error:'This room is full (maximum 3 players).'});if(r.players.some(p=>p.name.toLowerCase()===n.toLowerCase()))return cb?.({ok:false,error:'That player name is already being used in this room.'});const p={id:socket.id,name:n,budget:STARTING_BUDGET,characters:[]};r.players.push(p);socket.join(r.code);cb?.({ok:true,code:r.code});emitRoom(r);});
 socket.on('room:surprise-mode',({enabled},cb)=>{const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id));if(!r)return cb?.({ok:false,error:'You are not in a room.'});if(r.hostId!==socket.id)return cb?.({ok:false,error:'Only the host can change game mode.'});if(r.status!=='waiting')return cb?.({ok:false,error:'Game mode can only be changed before the auction starts.'});r.surpriseMode=!!enabled;emitRoom(r);cb?.({ok:true});});
 socket.on('auction:start',cb=>{const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id));if(!r)return cb?.({ok:false,error:'You are not in a room.'});if(r.hostId!==socket.id)return cb?.({ok:false,error:'Only the host can start.'});if(r.status!=='waiting'||r.players.length<2)return cb?.({ok:false,error:'At least 2 players are required.'});if(r.surpriseMode){const shuffled=[...r.characters];for(let i=shuffled.length-1;i>0;i--){const j=crypto.randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}r.characters=shuffled.slice(0,Math.min(8,shuffled.length));}r.status='auction';r.auctionIndex=0;emitRoom(r);advanceAuction(r.code);cb?.({ok:true});});
 socket.on('bid:place',({amount},cb)=>{const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id));if(!r||r.status!=='auction'||r.paused||!r.currentAuction)return cb?.({ok:false,error:'There is no active auction.'});const p=playerById(r,socket.id),bid=Number(amount),a=r.currentAuction;if(!Number.isSafeInteger(bid)||bid<=a.highestBid)return cb?.({ok:false,error:`Bid must be higher than ${a.highestBid.toLocaleString('en-IN')}.`});if(bid>p.budget)return cb?.({ok:false,error:'Your bid is higher than your remaining budget.'});const c=r.characters.find(x=>x.id===a.characterId);if(!c||r.soldIds.has(c.id))return cb?.({ok:false,error:'Character is no longer available.'});a.highestBid=bid;a.highestBidderId=p.id;a.endsAt=Math.max(Date.now(),a.endsAt)+5000;scheduleTimer(r);emitRoom(r);cb?.({ok:true});});
 socket.on('auction:pause',cb=>{const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id));if(!r||r.hostId!==socket.id)return cb?.({ok:false,error:'Only the host can pause.'});if(r.status!=='auction'||r.paused||!r.currentAuction)return cb?.({ok:false,error:'Auction cannot be paused during the character transition.'});r.remainingMs=Math.max(0,r.currentAuction.endsAt-Date.now());r.paused=true;stopTimer(r);emitRoom(r);cb?.({ok:true});});
 socket.on('auction:resume',cb=>{const r=[...rooms.values()].find(x=>x.players.some(p=>p.id===socket.id));if(!r||r.hostId!==socket.id)return cb?.({ok:false,error:'Only the host can resume.'});if(r.status!=='auction'||!r.paused||!r.currentAuction)return cb?.({ok:false,error:'Auction is not paused on an active character.'});r.paused=false;r.currentAuction.endsAt=Date.now()+(r.remainingMs||0);scheduleTimer(r);emitRoom(r);cb?.({ok:true});});
 socket.on('room:leave',()=>removePlayer(socket));socket.on('disconnect',()=>removePlayer(socket));
});
function removePlayer(socket){for(const [code,r] of rooms.entries()){const i=r.players.findIndex(p=>p.id===socket.id);if(i<0)continue;if(r.status==='waiting'){r.players.splice(i,1);if(!r.players.length)rooms.delete(code);else{if(r.hostId===socket.id)r.hostId=r.players[0].id;emitRoom(r);}}else{r.players[i].connected=false;emitRoom(r);}break;}}
app.get('/api/health',(_req,res)=>res.json({ok:true,rooms:rooms.size,cloudinary:cloudReady}));
server.listen(PORT,'0.0.0.0',()=>console.log(`Auction game running on port ${PORT}`));
