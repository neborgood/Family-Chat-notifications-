const express = require('express');
const webpush  = require('web-push');
const cors     = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const VAPID_PUBLIC  = 'BPhisKtv3tSJVTNs3Etbphf9vtcdJEDHooqq_rsKDVoZ_j5pjELB46zeGHWb0bs7wiU-W53xLmcqwxWndOVzmfI';
const VAPID_PRIVATE = 'uBxldQfVgqShMM6yGwpjMA5nlyDuz9OwDStfVGyBh-o';
webpush.setVapidDetails('mailto:familychat@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

const subscriptions = {};

app.get('/', (req, res) => res.send('Family Chat push server running'));

app.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

app.post('/subscribe', (req, res) => {
  const { subscription, name, room } = req.body;
  if (!subscription || !name || !room) return res.status(400).json({ error: 'Missing fields' });
  subscriptions[room + ':' + name] = { subscription, name, room };
  console.log('Subscribed:', name, 'room:', room);
  res.json({ ok: true });
});

app.post('/notify', async (req, res) => {
  const { room, sender, text } = req.body;
  if (!room || !sender || !text) return res.status(400).json({ error: 'Missing fields' });
  const payload = JSON.stringify({ title: sender + ' - Family Chat', body: text.slice(0, 100) });
  const targets = Object.values(subscriptions).filter(s => s.room === room && s.name !== sender);
  console.log('Notifying', targets.length, 'in', room);
  await Promise.allSettled(targets.map(t =>
    webpush.sendNotification(t.subscription, payload).catch(err => {
      if (err.statusCode === 410) delete subscriptions[t.room + ':' + t.name];
    })
  ));
  res.json({ ok: true, notified: targets.length });
});

app.post('/unsubscribe', (req, res) => {
  const { name, room } = req.body;
  if (name && room) delete subscriptions[room + ':' + name];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Push server on port', PORT));
