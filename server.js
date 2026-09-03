const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const DB = path.join(DATA, 'teachers-day.sqlite');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);
const database = new DatabaseSync(DB);
database.exec('CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, session_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, correct INTEGER NOT NULL, timestamp TEXT NOT NULL)');
const send = (res, code, data) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
const ranking = () => database.prepare('SELECT id, session_id AS sessionId, name, score, correct, timestamp FROM scores ORDER BY score DESC, timestamp ASC').all();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};

http.createServer((req,res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/leaderboard' && req.method === 'GET') return send(res, 200, {entries: ranking().slice(0,50)});
  if (url.pathname === '/api/score' && req.method === 'POST') {
    let raw=''; req.on('data', c => { raw += c; if(raw.length > 10000) req.destroy(); });
    return req.on('end', () => { try {
      const b=JSON.parse(raw||'{}'), name=String(b.name||'').trim().slice(0,50), score=Math.max(0,Math.min(1500,Number(b.score)||0)), correct=Math.max(0,Math.min(10,Number(b.correct)||0)), sessionId=String(b.sessionId||'').slice(0,100);
      if(!name || !sessionId) return send(res,400,{error:'Missing player details.'});
      const exists=database.prepare('SELECT 1 FROM scores WHERE session_id = ?').get(sessionId); if(exists) return send(res,409,{error:'This game has already been submitted.'});
      const entry={id:crypto.randomUUID(),sessionId,name,score,correct,timestamp:new Date().toISOString()};
      database.prepare('INSERT INTO scores (id, session_id, name, score, correct, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(entry.id,entry.sessionId,entry.name,entry.score,entry.correct,entry.timestamp);
      const list=ranking(); send(res,201,{entry,rank:list.findIndex(x=>x.id===entry.id)+1});
    } catch { send(res,400,{error:'Invalid score submission.'}); }});
  }
  let file=path.normalize(url.pathname === '/' ? path.join(PUBLIC,'index.html') : path.join(PUBLIC,url.pathname));
  if(!file.startsWith(PUBLIC)) {res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,data) => { if(err) file=path.join(PUBLIC,'index.html'),data=fs.readFileSync(file); res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data); });
}).listen(PORT,'0.0.0.0',()=>console.log(`Teachers' Day Arcade: http://localhost:${PORT}`));
